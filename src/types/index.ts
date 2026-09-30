export type Gender = 'M' | 'F' | 'N';

export interface Member {
  id: string;
  firstname: string;
  lastname: string;
  gender: Gender;
  birth: string | null;
  birthplace: string | null;
  death: string | null;
  deathplace: string | null;
  parentId: string | null;
  spouseId: string | null;
  notes: string | null;
  photo: string | null;
}

export type Orientation = 'top' | 'left';

export interface Settings {
  treeName: string;
  theme: number;
  orientation: Orientation;
  visibleGenerations: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface FamilyRelation {
  rel: string;
  person: Member;
}
