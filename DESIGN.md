---
name: DAO Autopilot
description: A trail-map interface where every DAO proposal is a route from posted to voted, in flat coastline colour.
colors:
  water: "#F5F1E4"
  paper: "#FFFDF6"
  land: "#8ED462"
  ink: "#2C2E2A"
  muted: "#55584E"
  on-land-muted: "#2F4A22"
  sand: "#E4DFCB"
  signal-yellow: "#F5E211"
  coral: "#FF705D"
  sky-blue: "#2BA0FF"
  lilac: "#EBC1FF"
  danger-ink: "#8A1F10"
typography:
  display:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  pill: "999px"
  field: "22px"
  lobe: "36px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "28px"
  xl: "36px"
components:
  button-primary:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "44px"
  button-primary-disabled:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.muted}"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
  chip-network:
    backgroundColor: "{colors.sky-blue}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  panel-setup:
    backgroundColor: "{colors.land}"
    textColor: "{colors.ink}"
    padding: "36px 32px 28px"
  panel-proposal:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lobe}"
    padding: "24px 28px 22px"
---

# Design System: DAO Autopilot

## Overview

**Creative North Star: "The Trail Map"**

The app reads like a printed park guide, not a trading terminal. Cream is the water, apple green is the land, and every proposal is a route with four stops (Posted, Relayed, Verdict, Vote) that you follow from left to right. Cause and effect is drawn as a path, so a stranger can see what happened and what is next without reading documentation.

Colour is flat and unmodulated, and it works. Green means land and a For vote, coral means an Against vote, lilac means skipped, yellow means the live step, blue means information. One grotesk at one weight carries all the text, so hierarchy comes from size, tight leading and ink versus muted ink. Controls are standard web controls (buttons, a text area, a range, inputs) dressed as capsules.

**Key Characteristics:**
- Flat colour fields, no gradients, no grain, no glass.
- Organic corners: lobes swell on one side, every other control is a full pill.
- One authored motion: a spring pop when a stop completes.
- Operate-first: the current step and its single action are always the loudest thing on screen.

## Colors

A cream ground with one saturated green region and four small capsule colours that each carry a meaning.

### Primary
- **Apple Land** (#8ED462): the setup lobe and the For outcome. The one large colour field on any screen.

### Secondary
- **Signal Yellow** (#F5E211): the primary action capsule and the live step. Only the current action is yellow.
- **Coral** (#FF705D): the Against outcome.
- **Sky Blue** (#2BA0FF): the network chip, link underlines and the keyboard focus ring.
- **Lilac** (#EBC1FF): the Skip outcome and any "did not vote" state.

### Neutral
- **Water Cream** (#F5F1E4): page ground.
- **Paper** (#FFFDF6): proposal lobes, the post form and text fields.
- **Trail Ink** (#2C2E2A): all text, the route lines and node outlines.
- **Muted Ink** (#55584E): secondary text on cream and paper.
- **Marsh Ink** (#2F4A22): secondary text on the green lobe, kept dark for contrast.
- **Sand** (#E4DFCB): disabled controls and the Closed badge.
- **Failure Ink** (#8A1F10): error text only.

### Named Rules
**The Colour Means Rule.** A state colour is never decoration. Green, coral and lilac appear only on outcomes, yellow only on the live step or action, blue only on information.

**The Words Too Rule.** Every state carries a text label as well as a colour ("Voted For", "Not voted", "Verdict").

## Typography

**Display, body and label font:** Hanken Grotesk (with system-ui fallback), weight 500 only.

**Character:** a friendly, slightly rounded grotesk used at a single weight, like a park signboard. Hierarchy is size and leading, never bold.

### Hierarchy
- **Display** (500, 2.25rem, 0.98, -0.035em): panel titles "Your autopilot" and "Proposals".
- **Title** (500, 1.25rem, 1.25, -0.02em): proposal titles.
- **Body** (500, 1rem, 1.5): outcome sentences, notes at 0.9375rem, measure capped near 56 to 68ch.
- **Label** (500, 0.875rem): meta lines, counters, transaction status. Numerals are tabular.

### Named Rules
**The One Weight Rule.** Never switch to bold. Emphasis is a colour pill or a size step.

## Layout

A centered column, max width 1200px with 24px gutters (16px on phones). Two panes at desktop: a fixed-width setup lobe (340 to 430px) and a flexible proposals column, 36px apart. Below 900px the panes stack, setup first. Spacing runs on an 8, 12, 18, 28, 36 rhythm; a heading has more space above than below. The setup route is a vertical dashed line with numbered nodes; the proposal trail is a horizontal line of four stops that becomes two rows on phones.

## Elevation & Depth

Flat. Depth comes from stacking flat fields (cream water, white paper lobes, green land) and from outlines, never from shadows. The only shadow in the product is RainbowKit's own account button.

### Named Rules
**The Flat Coast Rule.** No box shadows, no blur, no gradients on our own surfaces.

## Shapes

Lobes, not rectangles. Large panels have asymmetric corner radii so one side swells (the setup lobe is the most pronounced). Controls are full pills (999px). Fields use a 22px radius. Route nodes and trail dots are circles with a 2px ink outline; dashed lines mean "not yet", solid lines mean "reached".

## Components

### Buttons
- **Shape:** full pill (999px), 44px minimum height.
- **Primary:** Signal Yellow with Trail Ink text, 24px side padding. Blue, coral and lilac variants exist for secondary roles.
- **Hover / Focus:** hover scales to 1.04 with a spring overshoot (0.4s); press scales to 0.97; focus is a 3px sky blue outline offset 3px.
- **Disabled:** Sand with Muted Ink, no scale.
- **Text button:** underlined with a 2px blue underline, yellow highlight on hover.

### Chips
- **Network chip:** blue pill, not interactive.
- **Example chips:** outlined 2px ink pill, yellow on hover.

### Inputs / Fields
- **Style:** 2px ink outline, Paper fill, 22px radius, 12px by 16px padding.
- **Focus:** the shared blue outline. Counters turn Failure Ink when over limit.

### Navigation
A single top bar: logo mark and name left, network chip and account button right. No menu.

### Setup Route (signature)
Five nodes on a vertical line inside the green lobe. Done: ink node with a green check. Current: yellow node, its explanation and one action open. Locked: outlined node, muted, with "Needs: previous step".

### Proposal Trail (signature)
Four stops left to right. Done stops fill by outcome (ink, green, coral, lilac); the live stop is yellow and breathes; later stops are empty. Each reached stop links to its transaction. Below it, one sentence says what happened, then the AI's verdict pill, confidence and reason.

## Do's and Don'ts

### Do:
- **Do** keep one yellow action per screen state, at the current setup step.
- **Do** pair every state colour with a word.
- **Do** show wallet states plainly: signing, pending, confirmed, rejected, failed.
- **Do** keep the one spring motion for completion only, and honour reduced motion.

### Don't:
- **Don't** add shadows, gradients or glass to our own surfaces.
- **Don't** use bold type or a second typeface.
- **Don't** use a dark neon wallet-dashboard look.
- **Don't** use em dashes in any copy.
- **Don't** use a coloured side border on rows or callouts.
