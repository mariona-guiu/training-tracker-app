import { Easing } from 'react-native-reanimated'

// The web app's timings, ported rather than re-invented — see
// the web app these were ported from, which is retired and not public.
//
// The numbers carry across unchanged because Framer Motion and Reanimated
// describe a spring the same way: stiffness, damping and mass, fed to the
// same physics. So this is a genuine port of the feel, not an approximation
// of it by eye. If a spring is retuned in one place it must be retuned in
// both, or the two versions of the app drift apart.
//
// Durations are the one difference: seconds on the web, milliseconds here.

// Entering a workout and leaving it are the same movement in opposite
// directions, so both ends share this — tune once, and the two stay mirror
// images of each other. Overshoots slightly before settling, so the colour
// has some spring to it rather than sliding flatly into place.
export const WORKOUT_SPRING = { stiffness: 300, damping: 26, mass: 0.8 }

// The workout's content arrives once the colour has finished opening, and
// leaves before the colour does — never during, in either direction. Slow
// enough to read as a soft fade rather than a cut.
export const WORKOUT_CONTENT_FADE = { duration: 550, easing: Easing.out(Easing.ease) }

// Closing hands the colour back to the Workouts page, which dissolves it to
// reveal the stack. Going straight to the page instead would flash its
// background between the two screens, and anything quicker than this reads as
// a blink rather than a dissolve.
export const WORKOUT_REVEAL_FADE = { duration: 500, easing: Easing.inOut(Easing.ease) }

// A sub-view sliding in over its parent from the right, and back out the same
// way. Tighter than the workout springs: this is navigation, and it should
// feel like it got out of the way rather than performed.
export const PUSH_SPRING = { stiffness: 200, damping: 30, mass: 1 }

// Moving between exercises mid-workout. Stiffer and better damped than the
// workout spring — this happens repeatedly during a session, so it settles
// promptly instead of making a performance of it.
export const CAROUSEL_SPRING = { stiffness: 320, damping: 34, mass: 0.9 }

// A panel rising over the keyboard. Gentle on purpose — it should settle
// rather than snap, and it is deliberately slower than the keyboard's own
// ~250ms, which is the whole reason the panel is timed by hand rather than
// hung off the keyboard.
export const SHEET_SPRING = { stiffness: 190, damping: 26, mass: 1 }

// The pill sliding under the selected tab. Loose enough to overshoot a
// little and settle, which is what makes switching tabs feel like something
// moved rather than something appeared.
export const TAB_SPRING = { stiffness: 320, damping: 22, mass: 0.8 }

// A history cell opening and the page scrolling to keep it in view. Slack
// enough that a cell unfolds rather than snapping, and shared by both halves
// deliberately — the cell and the page move as one thing.
export const EXPAND_SPRING = { stiffness: 120, damping: 20, mass: 1 }

// A settings card growing to reveal what a switch turned on. Tighter than
// EXPAND_SPRING: this is a control answering a tap, not content unfolding.
export const REVEAL_SPRING = { stiffness: 210, damping: 26, mass: 1 }

// How a thrown card settles back into the stack. Deliberately loose — a stiff
// spring here reads as the card being yanked rather than coming to rest.
export const GLIDE_SPRING = { stiffness: 70, damping: 22, mass: 1 }

// A card's tilt under a finger, and its return. Light mass so it answers the
// drag immediately; well damped so it doesn't wobble afterwards.
export const TILT_SPRING = { stiffness: 300, damping: 28, mass: 0.5 }

// How quickly an exercise fades as it leaves the middle of the screen. Above
// 1 it is gone before it reaches the edge, so exercises hand over to each
// other rather than both being legible at once.
export const FADE_RATE = 1.35

// How far across a screen a drag has to travel to land on the next exercise,
// as a fraction of the width. A flick can carry it with less.
export const SWIPE_DISTANCE = 0.28
export const SWIPE_VELOCITY = 420

// How much the track gives when dragged past either end, where there is
// nothing to move on to.
export const DRAG_ELASTIC = 0.06
