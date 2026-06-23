import type { LinkableDefinition } from "@voyant-travel/core"

export const programLinkable: LinkableDefinition = {
  module: "mice",
  entity: "program",
  table: "mice_programs",
  idPrefix: "prog",
}

export const sessionLinkable: LinkableDefinition = {
  module: "mice",
  entity: "session",
  table: "mice_program_sessions",
  idPrefix: "mpss",
}

export const delegateLinkable: LinkableDefinition = {
  module: "mice",
  entity: "delegate",
  table: "mice_program_delegates",
  idPrefix: "mpdl",
}

export const roomingAssignmentLinkable: LinkableDefinition = {
  module: "mice",
  entity: "roomingAssignment",
  table: "mice_rooming_assignments",
  idPrefix: "mrma",
}

export const rfpLinkable: LinkableDefinition = {
  module: "mice",
  entity: "rfp",
  table: "mice_rfps",
  idPrefix: "mrfp",
}

export const bidLinkable: LinkableDefinition = {
  module: "mice",
  entity: "bid",
  table: "mice_bids",
  idPrefix: "mbid",
}

export const miceLinkable = {
  program: programLinkable,
  session: sessionLinkable,
  delegate: delegateLinkable,
  roomingAssignment: roomingAssignmentLinkable,
  rfp: rfpLinkable,
  bid: bidLinkable,
}
