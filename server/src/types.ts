export interface CharacterV2 {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  avatar: string;
  chat: string;
  talkativeness: number;
  fav: boolean;
  tags: string[];
  spec: string;
  spec_version: string;
  creatorcomment: string;
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    tags: string[];
    creator: string;
    character_version: string;
    alternate_greetings: string[];
    extensions: Record<string, unknown>;
    character_book?: unknown;
  };
  create_date?: string;
}

export interface CharacterListItem {
  name: string;
  avatar: string;
  description: string;
  personality: string;
  mes_example: string;
  tags: string[];
  world?: string;
  system_prompt?: string;
  date_added?: number;
  date_last_chat?: number;
  chat_size?: number;
  data?: CharacterV2['data'];
  fav?: boolean;
  create_date?: string;
}

export interface ChatFileInfo {
  file_name: string;
  chat_items: number;
  mes: string;
  last_mes: string;
}

export interface WorldInfoEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  selective: boolean;
  order: number;
  position: number;
  disable: boolean;
  excludeRecursion: boolean;
  probability: number;
  useProbability: boolean;
  group: string;
  scanDepth: number | null;
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  automationId: string;
  role: number | null;
  vectorized: boolean;
  groupOverride: boolean;
  groupWeight: number | null;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
}
