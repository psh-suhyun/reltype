import { ColShape } from './Column';

export type Cols = Record<string, ColShape<unknown, boolean, boolean>>;

export interface TableDef<
  TName extends string = string,
  TCols extends Cols = Cols,
> {
  readonly name: TName;
  readonly cols: TCols;
}
