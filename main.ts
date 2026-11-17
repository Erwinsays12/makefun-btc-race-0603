// Dip-buy mean-reversion bot for cbBTC (agent-fun/bars-replay/v1).
//
// Strategy, in one paragraph: the bot watches the 1-minute closes of CBBTC
// and buys the whole cash balance when the price has fallen hard over the
// last 40 bars, then sells the whole position when it has recovered enough
// to cover the round-trip cost with room to spare, or cuts it when the dip
// keeps falling. A round trip costs about 26 bps in fees, slippage and
// price impact, so the entry needs a move bigger than that to be worth
// taking; the dev window's 30-minute returns reverse about two thirds of
// the time after a large move, which is the edge this bot trades on.
//
// Rules, exactly as implemented in onBatch below (every decision is integer
// arithmetic on the closes the harness sent, so two runs on the same bars
// give the same orders, byte for byte):
//
// - Entry: flat and the close is at least DIP_BPS (90 bps) below the close
//   40 bars earlier -> buy with all the cash on hand. The reference close
//   is the latest close at or before 40 bars ago, so a minute the recorder
//   missed does not break the lookback.
// - Exit: holding and the position is worth TAKE_PROFIT_BPS (150 bps) over
//   its cost (the notional spent, fees included) -> sell it all; or worth
//   STOP_LOSS_BPS (60 bps) under its cost -> sell it all.
// - Fallback: if no buy has ever filled by batch FALLBACK_BAR (1320), buy
//   with all the cash anyway and hold to the end, so the entry always makes
//   at least one trade (the guardrail needs one) even on a window with no
//   sharp dip.
// - No new position is opened after batch LAST_ENTRY_BAR (1400); orders
//   decided on the last batch would be rejected (after_end) anyway.
// - Every order caps its slippage at MAX_SLIPPAGE_BPS (100 bps, 1%) past
//   the close it was decided on; a fill past that is refused and the signal
//   is simply re-checked on the next bar.
// - Warm-up batches (hello.warmup_bars) send no orders: the replay would
//   reject every one of them.
//
// The bot never reads the wall clock, the environment or any file, and it
// keeps no state between batches other than the closes it was sent and the
// count of its own filled buys. It speaks the protocol through the kit's
// TypeScript shim, vendored byte-identical under vendor/.

import { runBars, type BarsState, type Batch, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Lookback for the dip, in bars (minutes).
const WINDOW_BARS = 40;
// Buy when the close is at least this far below the close WINDOW_BARS ago.
const DIP_BPS = 90n;
// Sell when the position is worth this much over its cost.
const TAKE_PROFIT_BPS = 150n;
// Sell when the position is worth this much under its cost.
const STOP_LOSS_BPS = 60n;
// If no buy has filled by this batch, buy anyway and hold to the end.
const FALLBACK_BAR = 1320;
// Never open a new position after this batch.
const LAST_ENTRY_BAR = 1400;
// Max slippage past the close an order was decided on, in bps.
const MAX_SLIPPAGE_BPS = 100;
// A buy must spend at least this much (the replay's minimum notional).
const MIN_NOTIONAL = 1_000_000n;

const BPS = 10_000n;

// Closes by batch seq; null when the symbol missed that minute.
const closes: (bigint | null)[] = [];
// Filled buys seen so far (from the fills each batch carries).
let filledBuys = 0;

/** The latest close at or before batch seq, or null if none is known. */
function closeAtOrBefore(seq: number): bigint | null {
  let i = seq;
  while (i >= 0) {
    if (i < closes.length && closes[i] !== null && closes[i] !== undefined) return closes[i] as bigint;
    i -= 1;
  }
  return null;
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    // Record this batch's close for the symbol, if it sent one.
    while (closes.length <= state.seq) closes.push(null);
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes[state.seq] = BigInt(bar.c);
    }

    // Count our own filled buys, for the fallback.
    for (const fill of batch.fills) {
      if (fill.side === 'buy' && fill.status === 'filled' && fill.symbol === SYMBOL) filledBuys += 1;
    }

    // Warm-up batches take no orders: the replay rejects them all.
    if (state.warmingUp) return [];

    const price = state.close(SYMBOL);
    if (price === null) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined && held.qty > 0n) {
      // Exit: take profit, or cut the loss. Both are re-checked every bar,
      // so a sell the market refuses is sent again while its reason still
      // holds at the next close.
      const value = state.value(SYMBOL, held.qty);
      if (value * BPS >= held.cost * (BPS + TAKE_PROFIT_BPS)) {
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      if (value * BPS <= held.cost * (BPS - STOP_LOSS_BPS)) {
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    // Flat: no new position after the last entry bar.
    if (state.seq > LAST_ENTRY_BAR) return [];

    // Fallback: with no trade filled yet, buy and hold so the entry always
    // makes at least one trade.
    if (filledBuys === 0 && state.seq >= FALLBACK_BAR) {
      if (state.cash >= MIN_NOTIONAL) {
        const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [buy];
      }
      return [];
    }

    // Entry: the dip. The close WINDOW_BARS ago is the latest close at or
    // before that batch, so a missed minute does not break the lookback.
    const ref = closeAtOrBefore(state.seq - WINDOW_BARS);
    if (ref === null) return [];
    if (price * BPS <= ref * (BPS - DIP_BPS)) {
      if (state.cash >= MIN_NOTIONAL) {
        const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [buy];
      }
    }
    return [];
  },
});
