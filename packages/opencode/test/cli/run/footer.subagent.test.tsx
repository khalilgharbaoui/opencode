/** @jsxImportSource @opentui/solid */
import { expect, mock, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { createEffect, createSignal, onCleanup, onMount } from "solid-js"
import { RUN_THEME_FALLBACK } from "@/cli/cmd/run/theme"
import type { FooterSubagentDetail, StreamCommit } from "@/cli/cmd/run/types"

let mounts = 0
let cleanups = 0
const seen: string[] = []

function commit(text: string): StreamCommit {
  return {
    kind: "tool",
    text,
    phase: "progress",
    source: "tool",
    messageID: "msg-1",
    partID: "part-1",
    tool: "bash",
  }
}

void mock.module(new URL("../../../src/cli/cmd/run/scrollback.writer.tsx", import.meta.url).href, () => ({
  RunEntryContent(props: { commit: StreamCommit }) {
    createEffect(() => {
      seen.push(props.commit.text)
    })

    onMount(() => {
      mounts += 1
    })

    onCleanup(() => {
      cleanups += 1
    })

    return (
      <text width="100%" wrapMode="word">
        {props.commit.text}
      </text>
    )
  },
  separatorRows() {
    return 0
  },
}))

const { RunFooterSubagentBody } = await import("../../../src/cli/cmd/run/footer.subagent")

test("subagent body keeps live rows mounted when commit objects are replaced", async () => {
  mounts = 0
  cleanups = 0
  seen.length = 0

  const [detail, setDetail] = createSignal<FooterSubagentDetail>({
    sessionID: "session-1",
    commits: [commit("I")],
  })

  const app = await testRender(() => (
    <box width={80} height={8}>
      <RunFooterSubagentBody
        active={() => true}
        theme={() => RUN_THEME_FALLBACK}
        detail={detail}
        width={() => 80}
        onCycle={() => {}}
        onClose={() => {}}
      />
    </box>
  ), {
    width: 80,
    height: 8,
  })

  try {
    await app.renderOnce()
    expect(mounts).toBe(1)
    expect(cleanups).toBe(0)
    expect(seen).toEqual(["I"])

    setDetail({
      sessionID: "session-1",
      commits: [commit("I need to inspect the codebase")],
    })
    await app.renderOnce()
    expect(mounts).toBe(1)
    expect(cleanups).toBe(0)
    expect(seen).toEqual(["I", "I need to inspect the codebase"])

    setDetail({
      sessionID: "session-1",
      commits: [commit("I need to inspect the codebase carefully")],
    })
    await app.renderOnce()
    expect(mounts).toBe(1)
    expect(cleanups).toBe(0)
    expect(seen).toEqual(["I", "I need to inspect the codebase", "I need to inspect the codebase carefully"])
  } finally {
    app.renderer.destroy()
  }

  expect(cleanups).toBe(1)
})
