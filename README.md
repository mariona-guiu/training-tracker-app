# Training Tracker

A personal gym tracker for iOS, built in React Native with Expo. No backend, no
accounts, no network calls — everything lives on the phone in SQLite.

Six preset routines. You tap one, its colour grows out of the card and fills
the screen, and you log sets against each exercise in turn. A rest countdown
sweeps the screen between sets if you want it. Finishing gives you a summary,
and everything you have done is in History, grouped by week.

It is built for one person and tested on one phone, which is the whole quality
bar. It is public because the reasoning might be useful to someone, not because
it is a product.

## Running it

```bash
npm install
npm start        # then open it in Expo Go on the phone
```

Pinned to **Expo SDK 54** deliberately. Since May 2026 the App Store build of
Expo Go no longer follows new releases, so anything newer needs a paid Apple
Developer account and a custom build. See `CLAUDE.md`.

```bash
npm run lint                                          # oxlint; must report nothing
npx expo export --platform ios --output-dir /tmp/x    # does it still bundle?
```

Those two are the whole of the automated check, and they cover different
things. Neither sees layout, motion or touch behaviour — those need the phone.

## Where things are

```
app/            screens, routed by expo-router
src/data/       static data and shared constants. No I/O
src/db/         every SQLite access, one module per table
src/components/ shared components
src/theme/      the palette, the type scale, and how a screen gets them
docs/           the reasoning behind the data model
```

`CLAUDE.md` is the long version: the conventions that are not obvious from any
one file, the traps that cost a day each, and the rules that exist because
something broke. It is written for whoever works on this next, including an
assistant, and it is the most useful file in the repo.

## Licence

MIT — see `LICENSE`. Use it, copy it, take it apart. The reasoning in
`CLAUDE.md` is probably worth more than the code.

## A note on the history

This began as a port of a web PWA of the same app. That version is retired and
its repository is not public, so comments referring to "the web app" are
explaining where a value came from rather than pointing at something you can
go and read.
