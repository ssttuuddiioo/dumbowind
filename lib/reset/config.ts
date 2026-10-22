// Demo copy and timings for Reset America. Campaign text is placeholder —
// swap in Issue One's approved language before anything goes public.

export type Topic = {
  id: string;
  label: string;
  ask: string;
};

export const TOPICS: Topic[] = [
  {
    id: "money",
    label: "Money in politics",
    ask: "Issue One is asking Congress to pass reforms that cut the influence of big money in our elections.",
  },
  {
    id: "elections",
    label: "Safe elections",
    ask: "Issue One is asking lawmakers to fund and protect the people and systems that run our elections.",
  },
  {
    id: "congress",
    label: "A Congress that works",
    ask: "Issue One is asking Congress to fix how it works, so members can get things done for the people they serve.",
  },
  {
    id: "tech",
    label: "Big Tech",
    ask: "Issue One is asking Congress to hold social media platforms accountable for the harm they cause.",
  },
];

export const CAMPAIGN = {
  name: "Reset America",
  org: "Issue One",
  url: "https://issueone.org",
  urlLabel: "issueone.org",
};

export function topicById(id: string | null | undefined): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

// LED color for the ticker. One accent, nothing else.
export const LED = "#ff3b2a";

export const TIMING = {
  sessionIdleMs: 60_000, // no action for this long ends the session
  dropGraceMs: 4_000, // phone missing from presence this long ends the session
  headlineHoldMs: 10_000, // headline on screen before returning to the QR
  headlineDelayMs: 1_400, // roll first, then reveal the headline
};
