export interface TxtRecord {
  entries: string[];
  raw: string;
}

export interface MxRecord {
  priority: number;
  exchange: string;
}
