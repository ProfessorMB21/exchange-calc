# A Tayant Pay · Exchange Calculator

> **Not affiliated with TayantPay.** This is a personal project built to simplify calculating transfers using TayantPay's exchange rates. The rates are configured manually and should be kept up to date with TayantPay's current rates.

A transparent currency transfer calculator built to eliminate the hassle of hunting down a calculator every time you need to make an international transaction.

## Why This Exists

Making cross-border transfers often means juggling multiple calculators, conversion rates, and commission fees. This tool puts everything in one place — enter what you send, see exactly what your recipient gets, with every step of the calculation shown clearly.

## Features

- **Two calculation modes**
  - "I know what I'll send" — Find out what the recipient receives
  - "I know what they need" — Calculate exactly how much you must send

- **Step-by-step breakdown** — Every calculation is itemized so you know exactly how the numbers work

- **Fixed exchange rates** — No surprises; the rate stays locked while you plan

- **Flat commission** — Single fee shown upfront, not hidden in the margin

- **Quick amounts** — One-tap chips for common amounts

- **Currency swap** — Instantly switch source and target currencies

- **Light/Dark theme** — Follows your system preference, or toggle manually

- **Copy summary** — Export the transaction details to clipboard

## Usage

Open `index.html` in any browser. No server or build step required.

### Adding Currencies

Edit `app.js` and add an entry to the `CURRENCIES` object:

```javascript
CURRENCIES: {
  RUB: { name:'Russian Ruble', symbol:'₽', perBase:1, ... },
  ZMW: { name:'Zambian Kwacha', symbol:'K', perBase:0.210434, ... },
  // Add yours here
}
```

The rate is relative to the base currency (RUB by default). Any currency pair works automatically.

### Customizing Commission

Change the default commission in the CONFIG object:

```javascript
const CONFIG = {
  commission: 0.03,  // 3%
  // ...
};
```

Or set per-pair rates using `PAIR_OVERRIDES`.

## Tech

Vanilla HTML, CSS, and JavaScript. No frameworks, no dependencies. Just open and use.

## License

MIT