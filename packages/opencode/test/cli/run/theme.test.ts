import { expect, test } from "bun:test"
import { RGBA, type CliRenderer, type TerminalColors } from "@opentui/core"
import { generateSubtleSyntax as generateSharedSubtleSyntax, generateSyntax as generateSharedSyntax } from "@/cli/cmd/tui/context/theme"
import { generateSystem, resolveRunTheme, resolveTheme } from "@/cli/cmd/run/theme"

test("resolve run theme keeps direct syntax aligned with the shared tui scopes", async () => {
  const theme = await resolveRunTheme(renderer("dark"))
  const reference = sharedSyntaxTheme("dark")
  const expectedSyntax = generateSharedSyntax(reference)
  const expectedSubtleSyntax = generateSharedSubtleSyntax(reference)
  try {
    expect(theme.block.subtleSyntax).toBeDefined()
    expect(scopeList(theme.block.syntax)).toEqual(scopeList(expectedSyntax))
    expect(scopeList(theme.block.subtleSyntax)).toEqual(scopeList(expectedSubtleSyntax))
    expect(theme.block.syntax?.getStyle("markup.raw.inline")?.bg).toEqual(expectedSyntax.getStyle("markup.raw.inline")?.bg)
    expect(theme.block.syntax?.getStyle("tag")?.fg).toEqual(expectedSyntax.getStyle("tag")?.fg)
    expect(theme.block.syntax?.getStyle("tag.attribute")?.fg).toEqual(expectedSyntax.getStyle("tag.attribute")?.fg)
    expect(theme.block.syntax?.getStyle("attribute")?.fg).toEqual(expectedSyntax.getStyle("attribute")?.fg)
    expect(theme.block.syntax?.getStyle("markup.list.checked")?.fg).toEqual(
      expectedSyntax.getStyle("markup.list.checked")?.fg,
    )
    expect(theme.block.syntax?.getStyle("markup.list.unchecked")?.fg).toEqual(
      expectedSyntax.getStyle("markup.list.unchecked")?.fg,
    )
    expect(theme.block.syntax?.getStyle("markup.underline")?.underline).toBe(true)
  } finally {
    theme.block.syntax?.destroy()
    theme.block.subtleSyntax?.destroy()
    expectedSyntax.destroy()
    expectedSubtleSyntax.destroy()
  }
})

const base_palette = [
  "#15161e",
  "#f7768e",
  "#9ece6a",
  "#e0af68",
  "#7aa2f7",
  "#bb9af7",
  "#7dcfff",
  "#a9b1d6",
  "#414868",
  "#f7768e",
  "#9ece6a",
  "#e0af68",
  "#7aa2f7",
  "#bb9af7",
  "#7dcfff",
  "#c0caf5",
] as const

const colors = terminalColors()

function renderer(themeMode: "dark" | "light", input: TerminalColors = colors) {
  const item = {
    themeMode,
    getPalette: async (options) => terminalColors(options?.size ?? 256, input),
  } satisfies Pick<CliRenderer, "themeMode" | "getPalette">

  return item as CliRenderer
}

function terminalColors(size: number = 256, input: Partial<TerminalColors> = {}): TerminalColors {
  return {
    palette: Array.from({ length: size }, (_, index) => input.palette?.[index] ?? paletteColor(index)),
    defaultBackground: input.defaultBackground ?? "#1a1b26",
    defaultForeground: input.defaultForeground ?? "#c0caf5",
    cursorColor: input.cursorColor ?? "#ff9e64",
    mouseForeground: input.mouseForeground ?? null,
    mouseBackground: input.mouseBackground ?? null,
    tekForeground: input.tekForeground ?? null,
    tekBackground: input.tekBackground ?? null,
    highlightBackground: input.highlightBackground ?? "#33467c",
    highlightForeground: input.highlightForeground ?? "#c0caf5",
  }
}

function paletteColor(index: number): string {
  if (index < base_palette.length) {
    return base_palette[index]!
  }

  if (index < 232) {
    const value = index - 16
    const b = value % 6
    const g = Math.floor(value / 6) % 6
    const r = Math.floor(value / 36)
    const cube = (part: number) => (part === 0 ? 0 : part * 40 + 55)
    return hex(cube(r), cube(g), cube(b))
  }

  if (index < 256) {
    const gray = (index - 232) * 10 + 8
    return hex(gray, gray, gray)
  }

  return hex(0, 0, 0)
}

function hex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
    .join("")}`
}

function spread(color: RGBA) {
  const [r, g, b] = color.toInts()
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function distance(a: RGBA, b: RGBA) {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return dr * dr + dg * dg + db * db
}

function indexed(input: TerminalColors = colors, size: number = input.palette.length) {
  return terminalColors(size, input).palette.map((value, index) => RGBA.fromIndex(index, RGBA.fromHex(String(value))))
}

function nearestIndexed(palette: RGBA[], rgba: RGBA) {
  return palette.reduce(
    (best, item) => {
      const dist = distance(item, rgba)
      if (dist >= best.dist) return best
      return {
        dist,
        item,
      }
    },
    {
      dist: Number.POSITIVE_INFINITY,
      item: palette[0]!,
    },
  ).item
}

function expectRgba(color: unknown): RGBA {
  expect(color).toBeInstanceOf(RGBA)
  if (!(color instanceof RGBA)) {
    throw new Error("expected RGBA")
  }

  return color
}

function system(defaultBackground: string, defaultForeground: string, mode: "dark" | "light") {
  return resolveTheme(
    generateSystem(
      {
        ...colors,
        defaultBackground,
        defaultForeground,
      },
      mode,
    ),
    mode,
  )
}

function sharedSyntaxTheme(mode: "dark" | "light") {
  return {
    ...resolveTheme(generateSystem(colors, mode), mode),
    _hasSelectedListItemText: true,
  }
}

function scopeList(style: { getAllStyles(): Iterable<[string, unknown]> } | undefined) {
  return style ? [...style.getAllStyles()].map(([name]) => name).sort() : []
}

test("system theme snaps primary to the nearest indexed terminal color", () => {
  const theme = resolveTheme(generateSystem(colors, "dark"), "dark")

  expect(theme.primary).toEqual(nearestIndexed(indexed(), RGBA.fromHex(colors.cursorColor!)))
  expect(theme.primary).not.toEqual(nearestIndexed(indexed(colors, 16), RGBA.fromHex(colors.cursorColor!)))
})

test("resolve run theme uses the system primary for footer highlight", async () => {
  const expected = resolveTheme(generateSystem(colors, "dark"), "dark")
  const theme = await resolveRunTheme(renderer("dark"))

  expect(theme.footer.highlight).toEqual(expected.primary)
})

test("resolve run theme keeps footer shell surfaces as local blends", async () => {
  const expected = resolveTheme(generateSystem(colors, "dark"), "dark")
  const theme = await resolveRunTheme(renderer("dark"))

  expect(expectRgba(theme.footer.pane)).toEqual(expectRgba(expected.backgroundMenu))
  expect(expectRgba(theme.footer.shade)).toEqual(
    fadeColor(expectRgba(expected.backgroundMenu), expectRgba(expected.background), 0.12, 0.56, 0.72),
  )
  expect(expectRgba(theme.footer.surface)).toEqual(
    fadeColor(expectRgba(expected.backgroundMenu), expectRgba(expected.background), 0.18, 0.76, 0.9),
  )
  expect(expectRgba(theme.footer.line)).toEqual(
    fadeColor(expectRgba(expected.backgroundMenu), expectRgba(expected.background), 0.24, 0.9, 0.98),
  )
})

test("resolve run theme snaps tui splash tones to indexed colors", async () => {
  const expected = resolveTheme(generateSystem(colors, "dark"), "dark")
  const theme = await resolveRunTheme(renderer("dark"))
  const left = expectRgba(theme.splash.left)
  const right = expectRgba(theme.splash.right)
  const palette = indexed(colors)

  expect(RGBA.getIntentTag(left)).toBeLessThan(256)
  expect(RGBA.getIntentTag(right)).toBeLessThan(256)
  expect(left).toEqual(nearestIndexed(palette, expectRgba(expected.textMuted)))
  expect(right).toEqual(nearestIndexed(palette, expectRgba(expected.text)))
})

test("resolve run theme snaps splash shadows to remapped indexed colors", async () => {
  const base = await resolveRunTheme(renderer("dark"))
  const leftMix = mix(expectRgba(base.background), expectRgba(base.splash.left), 0.14)
  const rightMix = mix(expectRgba(base.background), expectRgba(base.splash.right), 0.14)
  const leftTarget = nudge(leftMix, 1)
  const rightTarget = nudge(rightMix, -1)
  const remapped = terminalColors(256, {
    ...colors,
    palette: colors.palette.map((value, index) => {
      if (index === 250) {
        const [r, g, b] = leftTarget.toInts()
        return hex(r, g, b)
      }

      if (index === 251) {
        const [r, g, b] = rightTarget.toInts()
        return hex(r, g, b)
      }

      return value
    }),
  })
  const theme = await resolveRunTheme(renderer("dark", remapped))
  const palette = indexed(remapped)
  const expectedLeft = nearestIndexed(palette, mix(expectRgba(theme.background), expectRgba(theme.splash.left), 0.14))
  const expectedRight = nearestIndexed(palette, mix(expectRgba(theme.background), expectRgba(theme.splash.right), 0.14))

  expect(RGBA.getIntentTag(expectedLeft)).toBe(250)
  expect(RGBA.getIntentTag(expectedRight)).toBe(251)
  expect(expectRgba(theme.splash.leftShadow)).toEqual(expectedLeft)
  expect(expectRgba(theme.splash.rightShadow)).toEqual(expectedRight)
  expect(expectRgba(theme.splash.leftShadow)).not.toEqual(leftMix)
  expect(expectRgba(theme.splash.rightShadow)).not.toEqual(rightMix)
  expect(RGBA.getIntentTag(nearestIndexed(indexed(colors), leftMix))).not.toBe(250)
  expect(RGBA.getIntentTag(nearestIndexed(indexed(colors), rightMix))).not.toBe(251)
})

test("system theme keeps dark surfaces close to neutral on colored backgrounds", () => {
  const theme = system("#002b36", "#93a1a1", "dark")

  expect(spread(theme.backgroundPanel)).toBeLessThan(25)
  expect(spread(theme.backgroundElement)).toBeLessThan(25)
})

test("system theme keeps light surfaces close to neutral on warm backgrounds", () => {
  const theme = system("#fbf1c7", "#3c3836", "light")

  expect(spread(theme.backgroundPanel)).toBeLessThan(60)
  expect(spread(theme.backgroundElement)).toBeLessThan(60)
})

test("system theme keeps dark surfaces neutral on saturated backgrounds", () => {
  const theme = system("#0000ff", "#ffffff", "dark")

  expect(spread(theme.backgroundPanel)).toBeLessThan(10)
  expect(spread(theme.backgroundElement)).toBeLessThan(10)
})

test("system theme keeps light surfaces neutral on saturated backgrounds", () => {
  const theme = system("#ffff00", "#000000", "light")

  expect(spread(theme.backgroundPanel)).toBeLessThan(60)
  expect(spread(theme.backgroundElement)).toBeLessThan(60)
})

function mix(base: RGBA, overlay: RGBA, alpha: number) {
  return RGBA.fromInts(
    Math.round((base.r + (overlay.r - base.r) * alpha) * 255),
    Math.round((base.g + (overlay.g - base.g) * alpha) * 255),
    Math.round((base.b + (overlay.b - base.b) * alpha) * 255),
  )
}

function fadeColor(color: RGBA, base: RGBA, fallback: number, scale: number, limit: number) {
  if (color.a === 0) {
    return RGBA.fromValues(color.r, color.g, color.b, Math.max(0, Math.min(1, fallback)))
  }

  const target = Math.min(limit, color.a * scale)
  const mix = Math.min(1, target / color.a)
  return RGBA.fromValues(
    base.r + (color.r - base.r) * mix,
    base.g + (color.g - base.g) * mix,
    base.b + (color.b - base.b) * mix,
    color.a,
  )
}

function nudge(color: RGBA, delta: number) {
  const [r, g, b] = color.toInts()
  const next = r + delta >= 0 && r + delta <= 255 ? r + delta : r - delta
  return RGBA.fromInts(next, g, b)
}
