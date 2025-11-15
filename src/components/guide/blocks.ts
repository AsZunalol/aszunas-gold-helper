export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "image"; url: string; alt?: string; caption?: string }
  | { type: "video"; url: string; caption?: string }
  | { type: "tip"; text: string }
  | { type: "step"; title?: string; text: string }
  | { type: "quote"; text: string; by?: string }
  | { type: "divider" };
