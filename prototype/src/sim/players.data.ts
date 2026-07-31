// THE SWAPPABLE DATA LAYER (constitution #3).
// All player identity — name pools, flags, labels — lives here as pure data.
// Swapping in licensed real players later = replace these tables, no code change.
// CONSTITUTION #2: fictional names only. Names below are invented and checked
// against REAL_NAME_BLOCKLIST at generation time.

import type { Archetype, Nationality, PositionLine } from '../types';

export const NATIONALITIES: Nationality[] = [
  'BRA', 'ARG', 'FRA', 'GER', 'ESP', 'ENG', 'POR', 'NED',
];

export const NATIONALITY_FLAG: Record<Nationality, string> = {
  BRA: '🇧🇷',
  ARG: '🇦🇷',
  FRA: '🇫🇷',
  GER: '🇩🇪',
  ESP: '🇪🇸',
  ENG: '🏴',
  POR: '🇵🇹',
  NED: '🇳🇱',
};

// Card-tile tint per nationality (hex). Applied at low alpha over the dark
// tile so text contrast (WCAG AA) is preserved; flag + text remain the
// primary encodings — color is the redundant preattentive cue, never alone.
// Hues chosen to avoid classic colorblind collision pairs (no red-green duo).
export const NATIONALITY_COLOR: Record<Nationality, string> = {
  BRA: '#a3e635', // lime (canary kit)
  ARG: '#7dd3fc', // sky blue stripes
  FRA: '#60a5fa', // les bleus
  GER: '#a1a1aa', // silver/black kit
  ESP: '#f87171', // la roja
  ENG: '#f8fafc', // white kit
  POR: '#34d399', // emerald (green half of kit)
  NED: '#fb923c', // oranje
};

export const NATIONALITY_NAME: Record<Nationality, string> = {
  BRA: 'Brazil',
  ARG: 'Argentina',
  FRA: 'France',
  GER: 'Germany',
  ESP: 'Spain',
  ENG: 'England',
  POR: 'Portugal',
  NED: 'Netherlands',
};

export const POSITION_LABEL: Record<PositionLine, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
};

// Fictional surname pools per nationality — clearly invented.
export const NAME_POOLS: Record<Nationality, string[]> = {
  BRA: ['Caldeira', 'Ventura', 'Peixoto', 'Maravao', 'Quintela', 'Barroso', 'Falcao Junior', 'Dourado', 'Nogueira', 'Sarmento', 'Tavares Filho', 'Beltrame'],
  ARG: ['Valdieri', 'Sartorelli', 'Brindisi', 'Lujano', 'Ferreyra', 'Montalvan', 'Cabrini', 'Zampetti', 'Roldano', 'Ibarra', 'Sueta', 'Villagra'],
  FRA: ['Delacour', 'Vasseur', 'Montreuil', 'Lamballe', 'Fournier', 'Clavet', 'Deschanel', 'Moreau', 'Bertillon', 'Savarin', 'Lautrec', 'Giroudan'],
  GER: ['Brandner', 'Vogelsang', 'Kesselring', 'Hartwig', 'Steinbach', 'Reiniger', 'Falkenau', 'Grunewald', 'Ostermann', 'Lindtner', 'Weisskopf', 'Dresner'],
  ESP: ['Navarrete', 'Bustillo', 'Carrasquilla', 'Montejano', 'Salguero', 'Torrecilla', 'Valdemoro', 'Zubizarra', 'Lorente', 'Casadevall', 'Miravalles', 'Ontiveros'],
  ENG: ['Bramwell', 'Hollingsworth', 'Ashcombe', 'Ravenshaw', 'Thistlewick', 'Pemberton', 'Calloway', 'Grimsdale', 'Hatherleigh', 'Wexford', 'Sturridge', 'Bellamy'],
  POR: ['Vasconcelos', 'Meirelles', 'Braganca', 'Fonseca', 'Salgado', 'Estrela', 'Moutinho', 'Carvalheira', 'Sequeira', 'Almada', 'Torrinha', 'Laranjeira'],
  NED: ['Van Dijkhuizen', 'Vermeeren', 'Hoogstra', 'Van Loon', 'Tiddens', 'Verhagen', 'Boskamp', 'Zuidema', 'Klaasen', 'Van Bever', 'Strootman', 'Wildschut'],
};

// First-initial pool for "R. Caldeira" style names.
export const FIRST_INITIALS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M',
  'N', 'P', 'R', 'S', 'T', 'V', 'W', 'Z',
];

// Blocklist of real star surnames (lowercase) — generation must never
// produce these. Extend freely; test enforces it.
export const REAL_NAME_BLOCKLIST: string[] = [
  'messi', 'ronaldo', 'neymar', 'mbappe', 'haaland', 'benzema', 'lewandowski',
  'kane', 'salah', 'debruyne', 'modric', 'bellingham', 'vinicius', 'rodri',
  'saka', 'foden', 'griezmann', 'lautaro', 'osimhen', 'musiala', 'wirtz',
  'pedri', 'gavi', 'yamal', 'valverde', 'alisson', 'ederson', 'courtois',
  'vandijk', 'marquinhos', 'rudiger', 'hernandez', 'dibu', 'martinez',
];

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  Speedster: 'Speedster',
  Playmaker: 'Playmaker',
  Poacher: 'Poacher',
  Destroyer: 'Destroyer',
  Sweeper: 'Sweeper',
  ShotStopper: 'Shot Stopper',
};

// Fictional AI manager club-style names (fictional clubs forever).
export const AI_MANAGER_NAMES = [
  'FC Aldervale', 'Real Bosquejo', 'Sporting Caldera', 'AFC Dunsbury',
  'Estrela do Vale', 'SV Falkenhof', 'Atletico Miraluz', 'RKZ Noordhaven',
];
