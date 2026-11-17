# makefun-btc-race-0603

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/Erwinsays12/makefun-btc-race-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/Erwinsays12/makefun-btc-race-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A dip-buy mean-reversion bot for Coinbase Wrapped BTC (cbBTC) on Solana, built for make.fun's "Race a BTC trading bot live for 24 hours" bounty. It trades 1-minute on-chain bars with $1,000 of paper money: it buys the whole cash balance when the close has fallen at least 90 bps over the last 40 minutes, sells when the position is worth 150 bps over its cost, cuts it at 60 bps under, and — if no dip ever comes — buys once late in the window so the entry always makes at least one trade. Local dev grade on the published 24-hour dev window: net PnL +$29.93 USDC (4 trades, max drawdown 0.66%).

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=a3dys77v&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
