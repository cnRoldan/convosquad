import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createTestDatabase } from './database-test-utils.mjs';

const database = await createTestDatabase();
try {
  const { rows: types } = await database.query(`select t.oid, t.typname, t.typtype, t.typcategory, t.typelem, n.nspname
    from pg_type t join pg_namespace n on n.oid = t.typnamespace`);
  const byOid = new Map(types.map((type) => [type.oid, type]));
  const tsType = (oid) => {
    const type = byOid.get(oid);
    if (type.typcategory === 'A') return `${tsType(type.typelem)}[]`;
    if (type.nspname === 'public' && type.typtype === 'e') return `Database['public']['Enums']['${type.typname}']`;
    if (type.nspname === 'public' && type.typtype === 'c') return `Database['public']['Tables']['${type.typname}']['Row']`;
    if (type.typname === 'void') return 'undefined';
    if (['json', 'jsonb'].includes(type.typname)) return 'Json';
    if (type.typcategory === 'N') return 'number';
    if (type.typcategory === 'B') return 'boolean';
    return 'string';
  };
  const { rows: tables } = await database.query(`select c.oid, c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by c.relname`);
  const { rows: enums } = await database.query(`select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels
    from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' group by t.typname order by t.typname`);
  const lines = ["// Generado desde las migraciones con npm run db:types.",
    'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];',
    '', 'export type Database = {', '  public: {', '    Tables: {'];
  for (const table of tables) {
    const { rows: columns } = await database.query(`select a.attname, a.atttypid, a.attnotnull, a.atthasdef
      from pg_attribute a where a.attrelid = $1 and a.attnum > 0 and not a.attisdropped order by a.attnum`, [table.oid]);
    const { rows: relationships } = await database.query(`select con.conname,
      array(select a.attname from unnest(con.conkey) with ordinality k(num, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.num order by k.ord) as columns,
      ref.relname as referenced_relation,
      exists (select 1 from pg_constraint u where u.conrelid = con.conrelid and u.contype in ('u', 'p') and con.conkey @> u.conkey) as is_one_to_one,
      array(select a.attname from unnest(con.confkey) with ordinality k(num, ord) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.num order by k.ord) as referenced_columns
      from pg_constraint con join pg_class ref on ref.oid = con.confrelid where con.contype = 'f' and con.conrelid = $1 order by con.conname`, [table.oid]);
    lines.push(`      ${table.relname}: {`);
    for (const shape of ['Row', 'Insert', 'Update']) {
      lines.push(`        ${shape}: {`);
      for (const column of columns) {
        const optional = shape === 'Update' || (shape === 'Insert' && (column.atthasdef || !column.attnotnull));
        lines.push(`          ${column.attname}${optional ? '?' : ''}: ${tsType(column.atttypid)}${column.attnotnull ? '' : ' | null'};`);
      }
      lines.push('        };');
    }
    lines.push('        Relationships: [');
    for (const relation of relationships) {
      lines.push(`          { foreignKeyName: '${relation.conname}'; columns: ${JSON.stringify(relation.columns)}; isOneToOne: ${relation.is_one_to_one}; referencedRelation: '${relation.referenced_relation}'; referencedColumns: ${JSON.stringify(relation.referenced_columns)}; },`);
    }
    lines.push('        ];', '      };');
  }
  lines.push('    };', '    Views: { [_ in never]: never };', '    Functions: {');
  const { rows: functions } = await database.query(`select p.proname, p.proargnames, p.proargtypes::oid[] as input_types,
    p.pronargdefaults, p.prorettype, p.proallargtypes, p.proargmodes from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by p.proname`);
  for (const fn of functions) {
    lines.push(`      ${fn.proname}: {`, fn.input_types.length ? '        Args: {' : '        Args: Record<string, never>;');
    fn.input_types.forEach((oid, index) => {
      const optional = index >= fn.input_types.length - fn.pronargdefaults;
      lines.push(`          ${fn.proargnames[index]}${optional ? '?' : ''}: ${tsType(oid)};`);
    });
    if (fn.input_types.length) lines.push('        };');
    if (fn.proargmodes?.includes('t')) {
      const fields = fn.proargmodes.flatMap((mode, index) => mode === 't' ? [`${fn.proargnames[index]}: ${tsType(fn.proallargtypes[index])}`] : []);
      lines.push(`        Returns: { ${fields.join('; ')} }[];`);
    } else {
      const composite = byOid.get(fn.prorettype).typtype === 'c';
      lines.push(`        Returns: ${tsType(fn.prorettype)}${composite ? '[]' : ''};`);
    }
    lines.push('      };');
  }
  lines.push('    };', '    Enums: {');
  for (const item of enums) lines.push(`      ${item.typname}: ${item.labels.map((label) => `'${label}'`).join(' | ')};`);
  lines.push('    };', '    CompositeTypes: { [_ in never]: never };', '  };', '};', '',
    "export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];",
    "export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];", '');
  const generated = lines.join('\n');
  const target = new URL('../src/types/database.ts', import.meta.url);
  if (process.argv.includes('--check')) {
    if (await readFile(target, 'utf8') !== generated) throw new Error('Tipos desactualizados: ejecuta npm run db:types');
    console.log('Tipos alineados con las migraciones');
  } else {
    await mkdir(new URL('../src/types/', import.meta.url), { recursive: true });
    await writeFile(target, generated);
    console.log('Tipos de base de datos generados');
  }
} finally {
  await database.close();
}
