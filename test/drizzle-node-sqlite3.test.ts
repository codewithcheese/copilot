import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
} from "vitest";
import { Database } from "@vscode/sqlite3";
import { drizzle, SQLite3Database } from "../src/db/node-sqlite3/driver";
import {
  asc,
  eq,
  gt,
  inArray,
  Name,
  placeholder,
  sql,
  TransactionRollbackError,
} from "drizzle-orm";
import {
  alias,
  blob,
  foreignKey,
  getTableConfig,
  getViewConfig,
  int,
  integer,
  primaryKey,
  sqliteTable,
  sqliteTableCreator,
  sqliteView,
  text,
} from "drizzle-orm/sqlite-core";

const ENABLE_LOGGING = false;

interface Context {
  client: Database;
  db: SQLite3Database;
}

// const test = anyTest as TestFn<Context>;

const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  json: blob("json", { mode: "json" }).$type<string[]>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`strftime('%s', 'now')`),
});

const usersOnUpdate = sqliteTable("users_on_update", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  updateCounter: integer("update_counter")
    .default(sql`1`)
    .$onUpdateFn(() => sql`update_counter + 1`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$onUpdate(
    () => new Date()
  ),
  alwaysNull: text("always_null")
    .$type<string | null>()
    .$onUpdate(() => null),
  // uppercaseName: text('uppercase_name').$onUpdateFn(() =>
  // 	sql`upper(s.name)`
  // ),  This doesn't seem to be supported in sqlite
});

const users2Table = sqliteTable("users2", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  cityId: integer("city_id").references(() => citiesTable.id),
});

const citiesTable = sqliteTable("cities", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
});

const coursesTable = sqliteTable("courses", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => courseCategoriesTable.id),
});

const courseCategoriesTable = sqliteTable("course_categories", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
});

const orders = sqliteTable("orders", {
  id: integer("id").primaryKey(),
  region: text("region").notNull(),
  product: text("product")
    .notNull()
    .$default(() => "random_string"),
  amount: integer("amount").notNull(),
  quantity: integer("quantity").notNull(),
});

const usersMigratorTable = sqliteTable("users12", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

const anotherUsersMigratorTable = sqliteTable("another_users", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

const pkExampleTable = sqliteTable(
  "pk_example",
  {
    id: integer("id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
  },
  (table) => ({
    compositePk: primaryKey(table.id, table.name),
  })
);

const bigIntExample = sqliteTable("big_int_example", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  bigInt: blob("big_int", { mode: "bigint" }).notNull(),
});

// To test aggregate functions
const aggregateTable = sqliteTable("aggregate_table", {
  id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
  name: text("name").notNull(),
  a: integer("a"),
  b: integer("b"),
  c: integer("c"),
  nullOnly: integer("null_only"),
});

export async function setupSetOperationTest(db: ReturnType<typeof drizzle>) {
  await db.run(sql`drop table if exists users2`);
  await db.run(sql`drop table if exists cities`);
  await db.run(sql`
    create table cities (
      id integer primary key,
      name text not null
    )
  `);

  await db.run(sql`
    create table users2 (
      id integer primary key,
      name text not null,
      city_id integer references ${citiesTable}(${citiesTable.id.name})
    )
  `);

  await db.insert(citiesTable).values([
    { id: 1, name: "New York" },
    { id: 2, name: "London" },
    { id: 3, name: "Tampa" },
  ]);

  await db.insert(users2Table).values([
    { id: 1, name: "John", cityId: 1 },
    { id: 2, name: "Jane", cityId: 2 },
    { id: 3, name: "Jack", cityId: 3 },
    { id: 4, name: "Peter", cityId: 3 },
    { id: 5, name: "Ben", cityId: 2 },
    { id: 6, name: "Jill", cityId: 1 },
    { id: 7, name: "Mary", cityId: 2 },
    { id: 8, name: "Sally", cityId: 1 },
  ]);
}

export async function setupAggregateFunctionsTest(
  db: ReturnType<typeof drizzle>
) {
  await db.run(sql`drop table if exists aggregate_table`);
  await db.run(
    sql`
      create table aggregate_table (
        id integer primary key autoincrement not null,
        name text not null,
        a integer,
        b integer,
        c integer,
        null_only integer
      );
    `
  );
  await db.insert(aggregateTable).values([
    { name: "value 1", a: 5, b: 10, c: 20 },
    { name: "value 1", a: 5, b: 20, c: 30 },
    { name: "value 2", a: 10, b: 50, c: 60 },
    { name: "value 3", a: 20, b: 20, c: null },
    { name: "value 4", a: null, b: 90, c: 120 },
    { name: "value 5", a: 80, b: 10, c: null },
    { name: "value 6", a: null, b: null, c: 150 },
  ]);
}

describe("SQLite3 Driver", () => {
  let db: ReturnType<typeof drizzle>;
  let sqlite3db: Database;

  beforeAll(() => {
    sqlite3db = new Database(":memory:");
    db = drizzle({ connection: sqlite3db });
  });

  afterAll(() => {
    return new Promise((resolve, reject) =>
      sqlite3db.close((err) => {
        if (err) reject(err);
        else resolve();
      })
    );
  });

  beforeEach(async () => {
    await db.run(sql`drop table if exists ${usersTable}`);
    await db.run(sql`drop table if exists ${users2Table}`);
    await db.run(sql`drop table if exists ${citiesTable}`);
    await db.run(sql`drop table if exists ${coursesTable}`);
    await db.run(sql`drop table if exists ${courseCategoriesTable}`);
    await db.run(sql`drop table if exists ${orders}`);
    await db.run(sql`drop table if exists ${bigIntExample}`);
    await db.run(sql`drop table if exists ${pkExampleTable}`);

    await db.run(sql`
      create table ${usersTable} (
        id integer primary key,
        name text not null,
        verified integer not null default 0,
        json blob,
        created_at integer not null default (strftime('%s', 'now'))
      )
    `);

    await db.run(sql`
      create table ${citiesTable} (
        id integer primary key,
        name text not null
      )
    `);

    await db.run(sql`
      create table ${courseCategoriesTable} (
        id integer primary key,
        name text not null
      )
    `);

    await db.run(sql`
      create table ${users2Table} (
        id integer primary key,
        name text not null,
        city_id integer references ${citiesTable}(id)
      )
    `);

    await db.run(sql`
      create table ${coursesTable} (
        id integer primary key,
        name text not null,
        category_id integer references ${courseCategoriesTable}(id)
      )
    `);

    await db.run(sql`
      create table ${orders} (
        id integer primary key,
        region text not null,
        product text not null,
        amount integer not null,
        quantity integer not null
      )
    `);

    await db.run(sql`
      create table ${pkExampleTable} (
        id integer not null,
        name text not null,
        email text not null,
        primary key (id, name)
      )
    `);

    await db.run(sql`
      create table ${bigIntExample} (
        id integer primary key,
        name text not null,
        big_int blob not null      )
    `);
  });

  test("table config: foreign keys name", async () => {
    const table = sqliteTable(
      "cities",
      {
        id: int("id").primaryKey(),
        name: text("name").notNull(),
        state: text("state"),
      },
      (t) => ({
        f: foreignKey({
          foreignColumns: [t.id],
          columns: [t.id],
          name: "custom_fk",
        }),
        f1: foreignKey(() => ({
          foreignColumns: [t.id],
          columns: [t.id],
          name: "custom_fk_deprecated",
        })),
      })
    );

    const tableConfig = getTableConfig(table);

    expect(tableConfig.foreignKeys.length).toBe(2);
    expect(tableConfig.foreignKeys[0]?.getName()).toBe("custom_fk");
    expect(tableConfig.foreignKeys[1]?.getName()).toBe("custom_fk_deprecated");
  });

  test("table config: primary keys name", async () => {
    const table = sqliteTable(
      "cities",
      {
        id: int("id").primaryKey(),
        name: text("name").notNull(),
        state: text("state"),
      },
      (t) => ({
        f: primaryKey({ columns: [t.id, t.name], name: "custom_pk" }),
      })
    );

    const tableConfig = getTableConfig(table);

    expect(tableConfig.primaryKeys.length).toBe(1);
    expect(tableConfig.primaryKeys[0]?.getName()).toBe("custom_pk");
  });

  test("insert bigint values", async () => {
    const bigIntExample = sqliteTable("big_int_example", {
      id: int("id").primaryKey(),
      name: text("name").notNull(),
      bigInt: blob("big_int", { mode: "bigint" }).notNull(),
    });

    await db.insert(bigIntExample).values({ name: "one", bigInt: BigInt("0") });
    await db
      .insert(bigIntExample)
      .values({ name: "two", bigInt: BigInt("127") });
    await db
      .insert(bigIntExample)
      .values({ name: "three", bigInt: BigInt("32767") });
    await db
      .insert(bigIntExample)
      .values({ name: "four", bigInt: BigInt("1234567890") });
    await db
      .insert(bigIntExample)
      .values({ name: "five", bigInt: BigInt("12345678900987654321") });

    const result = await db.select().from(bigIntExample).all();
    expect(result).toEqual([
      { id: 1, name: "one", bigInt: BigInt("0") },
      { id: 2, name: "two", bigInt: BigInt("127") },
      { id: 3, name: "three", bigInt: BigInt("32767") },
      { id: 4, name: "four", bigInt: BigInt("1234567890") },
      { id: 5, name: "five", bigInt: BigInt("12345678900987654321") },
    ]);
  });

  test("select all fields", async () => {
    const usersTable = sqliteTable("users", {
      id: int("id").primaryKey(),
      name: text("name").notNull(),
      verified: int("verified", { mode: "boolean" }).notNull().default(false),
      json: blob("json", { mode: "json" }).$type<string[]>(),
      createdAt: int("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`strftime('%s', 'now')`),
    });

    const now = Date.now();

    await db.insert(usersTable).values({ name: "John" });
    const result = await db.select().from(usersTable).all();
    expect(result[0]?.createdAt).toBeInstanceOf(Date);
    expect(
      Math.abs((result[0]?.createdAt as Date).getTime() - now)
    ).toBeLessThan(5000);
    expect(result).toEqual([
      {
        id: 1,
        name: "John",
        verified: false,
        json: null,
        createdAt: result[0]?.createdAt,
      },
    ]);
  });

  test("select partial", async () => {
    await db.insert(usersTable).values({ name: "John" }).run();
    const result = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .all();

    expect(result).toEqual([{ name: "John" }]);
  });

  test("select sql", async () => {
    await db.insert(usersTable).values({ name: "John" }).run();
    const users = await db
      .select({
        name: sql`upper(${usersTable.name})`,
      })
      .from(usersTable)
      .all();

    expect(users).toEqual([{ name: "JOHN" }]);
  });

  test("select typed sql", async () => {
    await db.insert(usersTable).values({ name: "John" }).run();
    const users = await db
      .select({
        name: sql<string>`upper(${usersTable.name})`,
      })
      .from(usersTable)
      .all();

    expect(users).toEqual([{ name: "JOHN" }]);
  });

  test("select distinct", async () => {
    const usersDistinctTable = sqliteTable("users_distinct", {
      id: integer("id").notNull(),
      name: text("name").notNull(),
    });

    await db.run(sql`drop table if exists ${usersDistinctTable}`);
    await db.run(
      sql`create table ${usersDistinctTable} (id integer, name text)`
    );

    await db
      .insert(usersDistinctTable)
      .values([
        { id: 1, name: "John" },
        { id: 1, name: "John" },
        { id: 2, name: "John" },
        { id: 1, name: "Jane" },
      ])
      .run();

    const users = await db
      .selectDistinct()
      .from(usersDistinctTable)
      .orderBy(usersDistinctTable.id, usersDistinctTable.name)
      .all();

    await db.run(sql`drop table ${usersDistinctTable}`);

    expect(users).toEqual([
      { id: 1, name: "Jane" },
      { id: 1, name: "John" },
      { id: 2, name: "John" },
    ]);
  });

  test("insert returning sql", async () => {
    const users = await db
      .insert(usersTable)
      .values({ name: "John" })
      .returning({
        name: sql`upper(${usersTable.name})`,
      })
      .all();

    expect(users).toEqual([{ name: "JOHN" }]);
  });

  test("delete returning sql", async () => {
    await db.insert(usersTable).values({ name: "John" }).run();
    const users = await db
      .delete(usersTable)
      .where(eq(usersTable.name, "John"))
      .returning({
        name: sql`upper(${usersTable.name})`,
      })
      .all();

    expect(users).toEqual([{ name: "JOHN" }]);
  });

  test("update returning sql", async () => {
    await db.insert(usersTable).values({ name: "John" }).run();
    const users = await db
      .update(usersTable)
      .set({ name: "Jane" })
      .where(eq(usersTable.name, "John"))
      .returning({
        name: sql`upper(${usersTable.name})`,
      })
      .all();

    expect(users).toEqual([{ name: "JANE" }]);
  });

  test("insert with auto increment", async () => {
    await db
      .insert(usersTable)
      .values([
        { name: "John" },
        { name: "Jane" },
        { name: "George" },
        { name: "Austin" },
      ])
      .run();
    const result = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .all();

    expect(result).toEqual([
      { id: 1, name: "John" },
      { id: 2, name: "Jane" },
      { id: 3, name: "George" },
      { id: 4, name: "Austin" },
    ]);
  });

  test("insert with default values", async () => {
    await db.insert(usersTable).values({ name: "John" }).run();
    const result = await db.select().from(usersTable).all();

    expect(result).toEqual([
      {
        id: 1,
        name: "John",
        verified: false,
        json: null,
        createdAt: result[0]!.createdAt,
      },
    ]);
  });

  test("insert with overridden default values", async () => {
    await db.insert(usersTable).values({ name: "John", verified: true }).run();
    const result = await db.select().from(usersTable).all();

    expect(result).toEqual([
      {
        id: 1,
        name: "John",
        verified: true,
        json: null,
        createdAt: result[0]!.createdAt,
      },
    ]);
  });

  test("update with returning all fields", async () => {
    const now = Date.now();

    await db.insert(usersTable).values({ name: "John" }).run();
    const users = await db
      .update(usersTable)
      .set({ name: "Jane" })
      .where(eq(usersTable.name, "John"))
      .returning()
      .all();

    expect(users[0]!.createdAt).toBeInstanceOf(Date);
    expect(Math.abs(users[0]!.createdAt.getTime() - now)).toBeLessThan(5000);
    expect(users).toEqual([
      {
        id: 1,
        name: "Jane",
        verified: false,
        json: null,
        createdAt: users[0]!.createdAt,
      },
    ]);
  });

  test("update with returning partial", async () => {
    await db.insert(usersTable).values({ name: "John" }).run();
    const users = await db
      .update(usersTable)
      .set({ name: "Jane" })
      .where(eq(usersTable.name, "John"))
      .returning({
        id: usersTable.id,
        name: usersTable.name,
      })
      .all();

    expect(users).toEqual([{ id: 1, name: "Jane" }]);
  });

  test("delete with returning all fields", async () => {
    const now = Date.now();

    await db.insert(usersTable).values({ name: "John" }).run();
    const users = await db
      .delete(usersTable)
      .where(eq(usersTable.name, "John"))
      .returning()
      .all();

    expect(users[0]!.createdAt).toBeInstanceOf(Date);
    expect(Math.abs(users[0]!.createdAt.getTime() - now)).toBeLessThan(5000);
    expect(users).toEqual([
      {
        id: 1,
        name: "John",
        verified: false,
        json: null,
        createdAt: users[0]!.createdAt,
      },
    ]);
  });

  test("delete with returning partial", async () => {
    await db.insert(usersTable).values({ name: "John" }).run();
    const users = await db
      .delete(usersTable)
      .where(eq(usersTable.name, "John"))
      .returning({
        id: usersTable.id,
        name: usersTable.name,
      })
      .all();

    expect(users).toEqual([{ id: 1, name: "John" }]);
  });

  test("insert + select", async () => {
    await db.insert(usersTable).values({ name: "John" }).run();
    const result = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .all();

    expect(result).toEqual([{ id: 1, name: "John" }]);

    await db.insert(usersTable).values({ name: "Jane" }).run();
    const result2 = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .all();

    expect(result2).toEqual([
      { id: 1, name: "John" },
      { id: 2, name: "Jane" },
    ]);
  });

  test("json insert", async () => {
    await db
      .insert(usersTable)
      .values({ name: "John", json: ["foo", "bar"] })
      .run();
    const result = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        json: usersTable.json,
      })
      .from(usersTable)
      .all();

    expect(result).toEqual([{ id: 1, name: "John", json: ["foo", "bar"] }]);
  });

  test("insert many", async () => {
    await db
      .insert(usersTable)
      .values([
        { name: "John" },
        { name: "Bruce", json: ["foo", "bar"] },
        { name: "Jane" },
        { name: "Austin", verified: true },
      ])
      .run();
    const result = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        json: usersTable.json,
        verified: usersTable.verified,
      })
      .from(usersTable)
      .all();

    expect(result).toEqual([
      { id: 1, name: "John", json: null, verified: false },
      { id: 2, name: "Bruce", json: ["foo", "bar"], verified: false },
      { id: 3, name: "Jane", json: null, verified: false },
      { id: 4, name: "Austin", json: null, verified: true },
    ]);
  });

  test("insert many with returning", async () => {
    const result = await db
      .insert(usersTable)
      .values([
        { name: "John" },
        { name: "Bruce", json: ["foo", "bar"] },
        { name: "Jane" },
        { name: "Austin", verified: true },
      ])
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        json: usersTable.json,
        verified: usersTable.verified,
      })
      .all();

    expect(result).toEqual([
      { id: 1, name: "John", json: null, verified: false },
      { id: 2, name: "Bruce", json: ["foo", "bar"], verified: false },
      { id: 3, name: "Jane", json: null, verified: false },
      { id: 4, name: "Austin", json: null, verified: true },
    ]);
  });

  test.skip("partial join with alias", async () => {
    const customerAlias = alias(usersTable, "customer");

    await db
      .insert(usersTable)
      .values([
        { id: 10, name: "Ivan" },
        { id: 11, name: "Hans" },
      ])
      .run();
    const result = await db
      .select({
        user: {
          id: usersTable.id,
          name: usersTable.name,
        },
        customer: {
          id: customerAlias.id,
          name: customerAlias.name,
        },
      })
      .from(usersTable)
      .leftJoin(customerAlias, eq(customerAlias.id, 11))
      .where(eq(usersTable.id, 10))
      .all();

    expect(result).toEqual([
      {
        user: { id: 10, name: "Ivan" },
        customer: { id: 11, name: "Hans" },
      },
    ]);
  });

  test.skip("full join with alias", async () => {
    const sqliteTable = sqliteTableCreator((name) => `prefixed_${name}`);

    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name").notNull(),
    });

    await db.run(sql`drop table if exists ${users}`);
    await db.run(
      sql`create table ${users} (id integer primary key, name text not null)`
    );

    const customers = alias(users, "customer");

    await db
      .insert(users)
      .values([
        { id: 10, name: "Ivan" },
        { id: 11, name: "Hans" },
      ])
      .run();
    const result = await db
      .select()
      .from(users)
      .leftJoin(customers, eq(customers.id, 11))
      .where(eq(users.id, 10))
      .all();

    expect(result).toEqual([
      {
        users: {
          id: 10,
          name: "Ivan",
        },
        customer: {
          id: 11,
          name: "Hans",
        },
      },
    ]);

    await db.run(sql`drop table ${users}`);
  });

  test.skip("select from alias", async () => {
    const sqliteTable = sqliteTableCreator((name) => `prefixed_${name}`);

    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name").notNull(),
    });

    await db.run(sql`drop table if exists ${users}`);
    await db.run(
      sql`create table ${users} (id integer primary key, name text not null)`
    );

    const user = alias(users, "user");
    const customers = alias(users, "customer");

    await db
      .insert(users)
      .values([
        { id: 10, name: "Ivan" },
        { id: 11, name: "Hans" },
      ])
      .run();
    const result = await db
      .select()
      .from(user)
      .leftJoin(customers, eq(customers.id, 11))
      .where(eq(user.id, 10))
      .all();

    expect(result).toEqual([
      {
        user: {
          id: 10,
          name: "Ivan",
        },
        customer: {
          id: 11,
          name: "Hans",
        },
      },
    ]);

    await db.run(sql`drop table ${users}`);
  });

  test("insert with spaces", async () => {
    await db
      .insert(usersTable)
      .values({ name: sql`'Jo   h     n'` })
      .run();
    const result = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .all();

    expect(result).toEqual([{ id: 1, name: "Jo   h     n" }]);
  });

  test("prepared statement", async () => {
    await db.insert(usersTable).values({ name: "John" }).run();
    const statement = db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .prepare();
    const result = await statement.all();

    expect(result).toEqual([{ id: 1, name: "John" }]);
  });

  test("prepared statement reuse", async () => {
    const stmt = db
      .insert(usersTable)
      .values({
        verified: true,
        name: placeholder("name"),
      })
      .prepare();

    for (let i = 0; i < 10; i++) {
      await stmt.run({ name: `John ${i}` });
    }

    const result = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        verified: usersTable.verified,
      })
      .from(usersTable)
      .all();

    expect(result).toEqual([
      { id: 1, name: "John 0", verified: true },
      { id: 2, name: "John 1", verified: true },
      { id: 3, name: "John 2", verified: true },
      { id: 4, name: "John 3", verified: true },
      { id: 5, name: "John 4", verified: true },
      { id: 6, name: "John 5", verified: true },
      { id: 7, name: "John 6", verified: true },
      { id: 8, name: "John 7", verified: true },
      { id: 9, name: "John 8", verified: true },
      { id: 10, name: "John 9", verified: true },
    ]);
  });

  test("prepared statement with placeholder in .where", async () => {
    await db.insert(usersTable).values({ name: "John" }).run();
    const stmt = db
      .select({
        id: usersTable.id,
        name: usersTable.name,
      })
      .from(usersTable)
      .where(eq(usersTable.id, placeholder("id")))
      .prepare();
    const result = await stmt.all({ id: 1 });

    expect(result).toEqual([{ id: 1, name: "John" }]);
  });

  test("select with group by as field", async () => {
    await db
      .insert(usersTable)
      .values([{ name: "John" }, { name: "Jane" }, { name: "Jane" }])
      .run();

    const result = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .groupBy(usersTable.name)
      .all();

    expect(result).toEqual([{ name: "Jane" }, { name: "John" }]);
  });

  test("select with group by as sql", async () => {
    await db
      .insert(usersTable)
      .values([{ name: "John" }, { name: "Jane" }, { name: "Jane" }])
      .run();

    const result = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .groupBy(sql`${usersTable.name}`)
      .all();

    expect(result).toEqual([{ name: "Jane" }, { name: "John" }]);
  });

  test("select with group by as sql + column", async () => {
    await db
      .insert(usersTable)
      .values([{ name: "John" }, { name: "Jane" }, { name: "Jane" }])
      .run();

    const result = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .groupBy(sql`${usersTable.name}`, usersTable.id)
      .all();

    expect(result).toEqual([
      { name: "John" },
      { name: "Jane" },
      { name: "Jane" },
    ]);
  });

  test("select with group by as column + sql", async () => {
    await db
      .insert(usersTable)
      .values([{ name: "John" }, { name: "Jane" }, { name: "Jane" }])
      .run();

    const result = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .groupBy(usersTable.id, sql`${usersTable.name}`)
      .all();

    expect(result).toEqual([
      { name: "John" },
      { name: "Jane" },
      { name: "Jane" },
    ]);
  });

  test("select with group by complex query", async () => {
    await db
      .insert(usersTable)
      .values([{ name: "John" }, { name: "Jane" }, { name: "Jane" }])
      .run();

    const result = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .groupBy(usersTable.id, sql`${usersTable.name}`)
      .orderBy(asc(usersTable.name))
      .limit(1)
      .all();

    expect(result).toEqual([{ name: "Jane" }]);
  });

  test("build query", () => {
    const query = db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .groupBy(usersTable.id, usersTable.name)
      .toSQL();

    expect(query).toEqual({
      sql: 'select "id", "name" from "users" group by "users"."id", "users"."name"',
      params: [],
    });
  });

  // test("migrator", async () => {
  //   await db.run(sql`drop table if exists another_users`);
  //   await db.run(sql`drop table if exists users12`);
  //   await db.run(sql`drop table if exists __drizzle_migrations`);
  //
  //   await migrate(db, { migrationsFolder: "./drizzle2/sqlite" });
  //
  //   await db
  //     .insert(usersMigratorTable)
  //     .values({ name: "John", email: "email" })
  //     .run();
  //   const result = await db.select().from(usersMigratorTable).all();
  //
  //   await db
  //     .insert(anotherUsersMigratorTable)
  //     .values({ name: "John", email: "email" })
  //     .run();
  //   const result2 = await db.select().from(usersMigratorTable).all();
  //
  //   expect(result).toEqual([{ id: 1, name: "John", email: "email" }]);
  //   expect(result2).toEqual([{ id: 1, name: "John", email: "email" }]);
  //
  //   await db.run(sql`drop table another_users`);
  //   await db.run(sql`drop table users12`);
  //   await db.run(sql`drop table __drizzle_migrations`);
  // });
  //
  // test("migrator : migrate with custom table", async () => {
  //   const customTable = randomString();
  //   await db.run(sql`drop table if exists another_users`);
  //   await db.run(sql`drop table if exists users12`);
  //   await db.run(sql`drop table if exists ${sql.identifier(customTable)}`);
  //
  //   await migrate(db, {
  //     migrationsFolder: "./drizzle2/sqlite",
  //     migrationsTable: customTable,
  //   });
  //
  //   // test if the custom migrations table was created
  //   const res = await db.all(
  //     sql`select * from ${sql.identifier(customTable)};`
  //   );
  //   expect(res.length).toBeGreaterThan(0);
  //
  //   // test if the migrated table are working as expected
  //   await db
  //     .insert(usersMigratorTable)
  //     .values({ name: "John", email: "email" });
  //   const result = await db.select().from(usersMigratorTable);
  //   expect(result).toEqual([{ id: 1, name: "John", email: "email" }]);
  //
  //   await db.run(sql`drop table another_users`);
  //   await db.run(sql`drop table users12`);
  //   await db.run(sql`drop table ${sql.identifier(customTable)}`);
  // });

  test("insert via db.run + select via db.all", async () => {
    await db.run(
      sql`insert into ${usersTable} (${new Name(
        usersTable.name.name
      )}) values (${"John"})`
    );

    const result = await db.all<{ id: number; name: string }>(
      sql`select id, name from "users"`
    );
    expect(result).toEqual([{ id: 1, name: "John" }]);
  });

  test("insert via db.get", async () => {
    const inserted = await db.get<{ id: number; name: string }>(
      sql`insert into ${usersTable} (${new Name(
        usersTable.name.name
      )}) values (${"John"}) returning ${usersTable.id}, ${usersTable.name}`
    );
    expect(inserted).toEqual({ id: 1, name: "John" });
  });

  test("insert via db.run + select via db.get", async () => {
    await db.run(
      sql`insert into ${usersTable} (${new Name(
        usersTable.name.name
      )}) values (${"John"})`
    );

    const result = await db.get<{ id: number; name: string }>(
      sql`select ${usersTable.id}, ${usersTable.name} from ${usersTable}`
    );
    expect(result).toEqual({ id: 1, name: "John" });
  });

  test("insert via db.get w/ query builder", async () => {
    const inserted = await db.get<
      Pick<typeof usersTable.$inferSelect, "id" | "name">
    >(
      db
        .insert(usersTable)
        .values({ name: "John" })
        .returning({ id: usersTable.id, name: usersTable.name })
    );
    expect(inserted).toEqual({ id: 1, name: "John" });
  });

  test.skip("left join (flat object fields)", async () => {
    const { id: cityId } = (
      await db
        .insert(citiesTable)
        .values([{ name: "Paris" }, { name: "London" }])
        .returning({ id: citiesTable.id })
        .all()
    )[0]!;

    await db
      .insert(users2Table)
      .values([{ name: "John", cityId }, { name: "Jane" }])
      .run();

    const res = await db
      .select({
        userId: users2Table.id,
        userName: users2Table.name,
        cityId: citiesTable.id,
        cityName: citiesTable.name,
      })
      .from(users2Table)
      .leftJoin(citiesTable, eq(users2Table.cityId, citiesTable.id))
      .all();

    expect(res).toEqual([
      { userId: 1, userName: "John", cityId, cityName: "Paris" },
      { userId: 2, userName: "Jane", cityId: null, cityName: null },
    ]);
  });

  test.skip("left join (grouped fields)", async () => {
    const { id: cityId } = (
      await db
        .insert(citiesTable)
        .values([{ name: "Paris" }, { name: "London" }])
        .returning({ id: citiesTable.id })
        .all()
    )[0]!;

    await db
      .insert(users2Table)
      .values([{ name: "John", cityId }, { name: "Jane" }])
      .run();

    const res = await db
      .select({
        id: users2Table.id,
        user: {
          name: users2Table.name,
          nameUpper: sql<string>`upper(${users2Table.name})`,
        },
        city: {
          id: citiesTable.id,
          name: citiesTable.name,
          nameUpper: sql<string>`upper(${citiesTable.name})`,
        },
      })
      .from(users2Table)
      .leftJoin(citiesTable, eq(users2Table.cityId, citiesTable.id))
      .all();

    expect(res).toEqual([
      {
        id: 1,
        user: { name: "John", nameUpper: "JOHN" },
        city: { id: cityId, name: "Paris", nameUpper: "PARIS" },
      },
      {
        id: 2,
        user: { name: "Jane", nameUpper: "JANE" },
        city: null,
      },
    ]);
  });

  test.skip("left join (all fields)", async () => {
    const { id: cityId } = (
      await db
        .insert(citiesTable)
        .values([{ name: "Paris" }, { name: "London" }])
        .returning({ id: citiesTable.id })
        .all()
    )[0]!;

    await db
      .insert(users2Table)
      .values([{ name: "John", cityId }, { name: "Jane" }])
      .run();

    const res = await db
      .select()
      .from(users2Table)
      .leftJoin(citiesTable, eq(users2Table.cityId, citiesTable.id))
      .all();

    expect(res).toEqual([
      {
        users2: {
          id: 1,
          name: "John",
          cityId,
        },
        cities: {
          id: cityId,
          name: "Paris",
        },
      },
      {
        users2: {
          id: 2,
          name: "Jane",
          cityId: null,
        },
        cities: null,
      },
    ]);
  });

  test("join subquery", async () => {
    await db
      .insert(courseCategoriesTable)
      .values([
        { name: "Category 1" },
        { name: "Category 2" },
        { name: "Category 3" },
        { name: "Category 4" },
      ])
      .run();

    await db
      .insert(coursesTable)
      .values([
        { name: "Development", categoryId: 2 },
        { name: "IT & Software", categoryId: 3 },
        { name: "Marketing", categoryId: 4 },
        { name: "Design", categoryId: 1 },
      ])
      .run();

    const sq2 = db
      .select({
        categoryId: courseCategoriesTable.id,
        category: courseCategoriesTable.name,
        total: sql<number>`count(${courseCategoriesTable.id})`,
      })
      .from(courseCategoriesTable)
      .groupBy(courseCategoriesTable.id, courseCategoriesTable.name)
      .as("sq2");

    const res = await db
      .select({
        courseName: coursesTable.name,
        categoryId: sq2.categoryId,
      })
      .from(coursesTable)
      .leftJoin(sq2, eq(coursesTable.categoryId, sq2.categoryId))
      .orderBy(coursesTable.name)
      .all();

    expect(res).toEqual([
      { courseName: "Design", categoryId: 1 },
      { courseName: "Development", categoryId: 2 },
      { courseName: "IT & Software", categoryId: 3 },
      { courseName: "Marketing", categoryId: 4 },
    ]);
  });

  test("with ... select", async () => {
    await db
      .insert(orders)
      .values([
        { region: "Europe", product: "A", amount: 10, quantity: 1 },
        { region: "Europe", product: "A", amount: 20, quantity: 2 },
        { region: "Europe", product: "B", amount: 20, quantity: 2 },
        { region: "Europe", product: "B", amount: 30, quantity: 3 },
        { region: "US", product: "A", amount: 30, quantity: 3 },
        { region: "US", product: "A", amount: 40, quantity: 4 },
        { region: "US", product: "B", amount: 40, quantity: 4 },
        { region: "US", product: "B", amount: 50, quantity: 5 },
      ])
      .run();

    const regionalSales = db.$with("regional_sales").as(
      db
        .select({
          region: orders.region,
          totalSales: sql<number>`sum(${orders.amount})`.as("total_sales"),
        })
        .from(orders)
        .groupBy(orders.region)
    );

    const topRegions = db.$with("top_regions").as(
      db
        .select({
          region: regionalSales.region,
        })
        .from(regionalSales)
        .where(
          gt(
            regionalSales.totalSales,
            db
              .select({ sales: sql`sum(${regionalSales.totalSales})/10` })
              .from(regionalSales)
          )
        )
    );

    const result = await db
      .with(regionalSales, topRegions)
      .select({
        region: orders.region,
        product: orders.product,
        productUnits: sql<number>`cast(sum(${orders.quantity}) as int)`,
        productSales: sql<number>`cast(sum(${orders.amount}) as int)`,
      })
      .from(orders)
      .where(
        inArray(
          orders.region,
          db.select({ region: topRegions.region }).from(topRegions)
        )
      )
      .groupBy(orders.region, orders.product)
      .orderBy(orders.region, orders.product)
      .all();

    expect(result).toEqual([
      {
        region: "Europe",
        product: "A",
        productUnits: 3,
        productSales: 30,
      },
      {
        region: "Europe",
        product: "B",
        productUnits: 5,
        productSales: 50,
      },
      {
        region: "US",
        product: "A",
        productUnits: 7,
        productSales: 70,
      },
      {
        region: "US",
        product: "B",
        productUnits: 9,
        productSales: 90,
      },
    ]);
  });

  test("select from subquery sql", async () => {
    await db
      .insert(users2Table)
      .values([{ name: "John" }, { name: "Jane" }])
      .run();

    const sq = db
      .select({
        name: sql<string>`${users2Table.name} || ' modified'`.as("name"),
      })
      .from(users2Table)
      .as("sq");

    const res = await db.select({ name: sq.name }).from(sq).all();

    expect(res).toEqual([{ name: "John modified" }, { name: "Jane modified" }]);
  });

  test("select a field without joining its table", () => {
    expect(() =>
      db.select({ name: users2Table.name }).from(usersTable).prepare()
    ).toThrow();
  });

  test("select all fields from subquery without alias", () => {
    const sq = db
      .$with("sq")
      .as(
        db
          .select({ name: sql<string>`upper(${users2Table.name})` })
          .from(users2Table)
      );

    expect(() => db.select().from(sq).prepare()).toThrow();
  });

  test("select count()", async () => {
    await db
      .insert(usersTable)
      .values([{ name: "John" }, { name: "Jane" }])
      .run();

    const res = await db
      .select({ count: sql`count(*)` })
      .from(usersTable)
      .all();

    expect(res).toEqual([{ count: 2 }]);
  });

  test("having", async () => {
    await db
      .insert(citiesTable)
      .values([{ name: "London" }, { name: "Paris" }, { name: "New York" }])
      .run();

    await db
      .insert(users2Table)
      .values([
        { name: "John", cityId: 1 },
        { name: "Jane", cityId: 1 },
        { name: "Jack", cityId: 2 },
      ])
      .run();

    const result = await db
      .select({
        id: citiesTable.id,
        name: sql<string>`upper(${citiesTable.name})`.as("upper_name"),
        usersCount: sql<number>`count(${users2Table.id})`.as("users_count"),
      })
      .from(citiesTable)
      .leftJoin(users2Table, eq(users2Table.cityId, citiesTable.id))
      .where(({ name }) => sql`length(${name}) >= 3`)
      .groupBy(citiesTable.id)
      .having(({ usersCount }) => sql`${usersCount} > 0`)
      .orderBy(({ name }) => name)
      .all();

    expect(result).toEqual([
      {
        id: 1,
        name: "LONDON",
        usersCount: 2,
      },
      {
        id: 2,
        name: "PARIS",
        usersCount: 1,
      },
    ]);
  });

  test("view", async () => {
    const newYorkers1 = sqliteView("new_yorkers").as((qb) =>
      qb.select().from(users2Table).where(eq(users2Table.cityId, 1))
    );

    const newYorkers2 = sqliteView("new_yorkers", {
      id: integer("id").primaryKey(),
      name: text("name").notNull(),
      cityId: integer("city_id").notNull(),
    }).as(sql`select * from ${users2Table} where ${eq(users2Table.cityId, 1)}`);

    const newYorkers3 = sqliteView("new_yorkers", {
      id: integer("id").primaryKey(),
      name: text("name").notNull(),
      cityId: integer("city_id").notNull(),
    }).existing();

    await db.run(
      sql`create view new_yorkers as ${getViewConfig(newYorkers1).query}`
    );

    await db
      .insert(citiesTable)
      .values([{ name: "New York" }, { name: "Paris" }])
      .run();

    await db
      .insert(users2Table)
      .values([
        { name: "John", cityId: 1 },
        { name: "Jane", cityId: 1 },
        { name: "Jack", cityId: 2 },
      ])
      .run();

    const result1 = await db.select().from(newYorkers1).all();
    expect(result1).toEqual([
      { id: 1, name: "John", cityId: 1 },
      { id: 2, name: "Jane", cityId: 1 },
    ]);

    const result2 = await db.select().from(newYorkers2).all();
    expect(result2).toEqual([
      { id: 1, name: "John", cityId: 1 },
      { id: 2, name: "Jane", cityId: 1 },
    ]);

    const result3 = await db.select().from(newYorkers3).all();
    expect(result3).toEqual([
      { id: 1, name: "John", cityId: 1 },
      { id: 2, name: "Jane", cityId: 1 },
    ]);

    const result4 = await db
      .select({ name: newYorkers1.name })
      .from(newYorkers1)
      .all();
    expect(result4).toEqual([{ name: "John" }, { name: "Jane" }]);

    await db.run(sql`drop view ${newYorkers1}`);
  });

  test("insert null timestamp", async () => {
    const test = sqliteTable("test", {
      t: integer("t", { mode: "timestamp" }),
    });

    await db.run(sql`create table ${test} (t timestamp)`);

    await db.insert(test).values({ t: null }).run();
    const res = await db.select().from(test).all();
    expect(res).toEqual([{ t: null }]);

    await db.run(sql`drop table ${test}`);
  });

  test("select from raw sql", async () => {
    const result = await db
      .select({
        id: sql<number>`id`,
        name: sql<string>`name`,
      })
      .from(sql`(select 1 as id, 'John' as name) as users`)
      .all();

    expect(result).toEqual([{ id: 1, name: "John" }]);
  });

  test.skip("select from raw sql with joins", async () => {
    const result = await db
      .select({
        id: sql<number>`users.id`,
        name: sql<string>`users.name`,
        userCity: sql<string>`users.city`,
        cityName: sql<string>`cities.name`,
      })
      .from(sql`(select 1 as id, 'John' as name, 'New York' as city) as users`)
      .leftJoin(
        sql`(select 1 as id, 'Paris' as name) as cities`,
        sql`cities.id = users.id`
      )
      .all();

    expect(result).toEqual([
      { id: 1, name: "John", userCity: "New York", cityName: "Paris" },
    ]);
  });

  test.skip("join on aliased sql from select", async () => {
    const result = await db
      .select({
        userId: sql<number>`users.id`.as("userId"),
        name: sql<string>`users.name`,
        userCity: sql<string>`users.city`,
        cityId: sql<number>`cities.id`.as("cityId"),
        cityName: sql<string>`cities.name`,
      })
      .from(sql`(select 1 as id, 'John' as name, 'New York' as city) as users`)
      .leftJoin(sql`(select 1 as id, 'Paris' as name) as cities`, (cols) =>
        eq(cols.cityId, cols.userId)
      )
      .all();

    expect(result).toEqual([
      {
        userId: 1,
        name: "John",
        userCity: "New York",
        cityId: 1,
        cityName: "Paris",
      },
    ]);
  });

  test("join on aliased sql from with clause", async () => {
    const users = db.$with("users").as(
      db
        .select({
          id: sql<number>`id`.as("userId"),
          name: sql<string>`name`.as("userName"),
          city: sql<string>`city`.as("city"),
        })
        .from(
          sql`(select 1 as id, 'John' as name, 'New York' as city) as users`
        )
    );

    const cities = db.$with("cities").as(
      db
        .select({
          id: sql<number>`id`.as("cityId"),
          name: sql<string>`name`.as("cityName"),
        })
        .from(sql`(select 1 as id, 'Paris' as name) as cities`)
    );

    const result = await db
      .with(users, cities)
      .select({
        userId: users.id,
        name: users.name,
        userCity: users.city,
        cityId: cities.id,
        cityName: cities.name,
      })
      .from(users)
      .leftJoin(cities, (cols) => eq(cols.cityId, cols.userId))
      .all();

    expect(result).toEqual([
      {
        userId: 1,
        name: "John",
        userCity: "New York",
        cityId: 1,
        cityName: "Paris",
      },
    ]);
  });

  test("prefixed table", async () => {
    const sqliteTable = sqliteTableCreator((name) => `myprefix_${name}`);

    const users = sqliteTable("test_prefixed_table_with_unique_name", {
      id: integer("id").primaryKey(),
      name: text("name").notNull(),
    });

    await db.run(sql`drop table if exists ${users}`);

    await db.run(
      sql`create table myprefix_test_prefixed_table_with_unique_name (id integer not null primary key, name text not null)`
    );

    await db.insert(users).values({ id: 1, name: "John" }).run();

    const result = await db.select().from(users).all();

    expect(result).toEqual([{ id: 1, name: "John" }]);

    await db.run(sql`drop table ${users}`);
  });

  test("orderBy with aliased column", () => {
    const query = db
      .select({
        test: sql`something`.as("test"),
      })
      .from(users2Table)
      .orderBy((fields) => fields.test)
      .toSQL();

    expect(query.sql).toBe(
      'select something as "test" from "users2" order by "test"'
    );
  });

  test.skip("transaction", async () => {
    const users = sqliteTable("users_transactions", {
      id: integer("id").primaryKey(),
      balance: integer("balance").notNull(),
    });
    const products = sqliteTable("products_transactions", {
      id: integer("id").primaryKey(),
      price: integer("price").notNull(),
      stock: integer("stock").notNull(),
    });

    await db.run(sql`drop table if exists ${users}`);
    await db.run(sql`drop table if exists ${products}`);

    await db.run(
      sql`create table users_transactions (id integer not null primary key, balance integer not null)`
    );
    await db.run(
      sql`create table products_transactions (id integer not null primary key, price integer not null, stock integer not null)`
    );

    const user = await db
      .insert(users)
      .values({ balance: 100 })
      .returning()
      .get();
    const product = await db
      .insert(products)
      .values({ price: 10, stock: 10 })
      .returning()
      .get();

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ balance: user.balance - product.price })
        .where(eq(users.id, user.id))
        .run();
      await tx
        .update(products)
        .set({ stock: product.stock - 1 })
        .where(eq(products.id, product.id))
        .run();
    });

    const result = await db.select().from(users).all();

    expect(result).toEqual([{ id: 1, balance: 90 }]);

    await db.run(sql`drop table ${users}`);
    await db.run(sql`drop table ${products}`);
  });

  test("transaction rollback", async () => {
    const users = sqliteTable("users_transactions_rollback", {
      id: integer("id").primaryKey(),
      balance: integer("balance").notNull(),
    });

    await db.run(sql`drop table if exists ${users}`);

    await db.run(
      sql`create table users_transactions_rollback (id integer not null primary key, balance integer not null)`
    );

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(users).values({ balance: 100 }).run();
        tx.rollback();
      })
    ).rejects.toThrow(TransactionRollbackError);

    const result = await db.select().from(users).all();

    expect(result).toEqual([]);

    await db.run(sql`drop table ${users}`);
  });

  test("nested transaction", async () => {
    const users = sqliteTable("users_nested_transactions", {
      id: integer("id").primaryKey(),
      balance: integer("balance").notNull(),
    });

    await db.run(sql`drop table if exists ${users}`);

    await db.run(
      sql`create table users_nested_transactions (id integer not null primary key, balance integer not null)`
    );

    await db.transaction(async (tx) => {
      await tx.insert(users).values({ balance: 100 }).run();

      await tx.transaction(async (tx) => {
        await tx.update(users).set({ balance: 200 }).run();
      });
    });

    const result = await db.select().from(users).all();

    expect(result).toEqual([{ id: 1, balance: 200 }]);

    await db.run(sql`drop table ${users}`);
  });

  test("nested transaction rollback", async () => {
    const users = sqliteTable("users_nested_transactions_rollback", {
      id: integer("id").primaryKey(),
      balance: integer("balance").notNull(),
    });

    await db.run(sql`drop table if exists ${users}`);

    await db.run(
      sql`create table users_nested_transactions_rollback (id integer not null primary key, balance integer not null)`
    );

    await db.transaction(async (tx) => {
      await tx.insert(users).values({ balance: 100 }).run();

      await expect(
        tx.transaction(async (tx) => {
          await tx.update(users).set({ balance: 200 }).run();
          tx.rollback();
        })
      ).rejects.toThrow(TransactionRollbackError);
    });

    const result = await db.select().from(users).all();

    expect(result).toEqual([{ id: 1, balance: 100 }]);

    await db.run(sql`drop table ${users}`);
  });

  test("join subquery with join", async () => {
    const internalStaff = sqliteTable("internal_staff", {
      userId: integer("user_id").notNull(),
    });

    const customUser = sqliteTable("custom_user", {
      id: integer("id").notNull(),
    });

    const ticket = sqliteTable("ticket", {
      staffId: integer("staff_id").notNull(),
    });

    await db.run(sql`drop table if exists ${internalStaff}`);
    await db.run(sql`drop table if exists ${customUser}`);
    await db.run(sql`drop table if exists ${ticket}`);

    await db.run(sql`create table internal_staff (user_id integer not null)`);
    await db.run(sql`create table custom_user (id integer not null)`);
    await db.run(sql`create table ticket (staff_id integer not null)`);

    await db.insert(internalStaff).values({ userId: 1 }).run();
    await db.insert(customUser).values({ id: 1 }).run();
    await db.insert(ticket).values({ staffId: 1 }).run();

    const subq = db
      .select()
      .from(internalStaff)
      .leftJoin(customUser, eq(internalStaff.userId, customUser.id))
      .as("internal_staff");

    const mainQuery = await db
      .select()
      .from(ticket)
      .leftJoin(subq, eq(subq.internal_staff.userId, ticket.staffId))
      .all();

    expect(mainQuery).toEqual([
      {
        ticket: { staffId: 1 },
        internal_staff: {
          internal_staff: { userId: 1 },
          custom_user: { id: 1 },
        },
      },
    ]);

    await db.run(sql`drop table ${internalStaff}`);
    await db.run(sql`drop table ${customUser}`);
    await db.run(sql`drop table ${ticket}`);
  });

  test.skip("join view as subquery", async () => {
    const users = sqliteTable("users_join_view", {
      id: integer("id").primaryKey(),
      name: text("name").notNull(),
      cityId: integer("city_id").notNull(),
    });

    const newYorkers = sqliteView("new_yorkers").as((qb) =>
      qb.select().from(users).where(eq(users.cityId, 1))
    );

    await db.run(sql`drop table if exists ${users}`);
    await db.run(sql`drop view if exists ${newYorkers}`);

    await db.run(
      sql`create table ${users} (id integer not null primary key, name text not null, city_id integer not null)`
    );
    await db.run(
      sql`create view ${newYorkers} as ${getViewConfig(newYorkers).query}`
    );

    await db
      .insert(users)
      .values([
        { name: "John", cityId: 1 },
        { name: "Jane", cityId: 2 },
        { name: "Jack", cityId: 1 },
        { name: "Jill", cityId: 2 },
      ])
      .run();

    const sq = db.select().from(newYorkers).as("new_yorkers_sq");

    const result = await db
      .select()
      .from(users)
      .leftJoin(sq, eq(users.id, sq.id))
      .all();

    expect(result).toEqual([
      {
        users_join_view: { id: 1, name: "John", cityId: 1 },
        new_yorkers_sq: { id: 1, name: "John", cityId: 1 },
      },
      {
        users_join_view: { id: 2, name: "Jane", cityId: 2 },
        new_yorkers_sq: null,
      },
      {
        users_join_view: { id: 3, name: "Jack", cityId: 1 },
        new_yorkers_sq: { id: 3, name: "Jack", cityId: 1 },
      },
      {
        users_join_view: { id: 4, name: "Jill", cityId: 2 },
        new_yorkers_sq: null,
      },
    ]);

    await db.run(sql`drop view ${newYorkers}`);
    await db.run(sql`drop table ${users}`);
  });

  test("insert with onConflict do nothing", async () => {
    await db.insert(usersTable).values({ id: 1, name: "John" }).run();

    await db
      .insert(usersTable)
      .values({ id: 1, name: "John" })
      .onConflictDoNothing()
      .run();

    const res = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, 1))
      .all();

    expect(res).toEqual([{ id: 1, name: "John" }]);
  });

  test("insert with onConflict do nothing using composite pk", async () => {
    await db
      .insert(pkExampleTable)
      .values({ id: 1, name: "John", email: "john@example.com" })
      .run();

    await db
      .insert(pkExampleTable)
      .values({ id: 1, name: "John", email: "john1@example.com" })
      .onConflictDoNothing()
      .run();

    const res = await db
      .select({
        id: pkExampleTable.id,
        name: pkExampleTable.name,
        email: pkExampleTable.email,
      })
      .from(pkExampleTable)
      .where(eq(pkExampleTable.id, 1))
      .all();

    expect(res).toEqual([{ id: 1, name: "John", email: "john@example.com" }]);
  });

  test("insert with onConflict do nothing using target", async () => {
    await db.insert(usersTable).values({ id: 1, name: "John" }).run();

    await db
      .insert(usersTable)
      .values({ id: 1, name: "John" })
      .onConflictDoNothing({ target: usersTable.id })
      .run();

    const res = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, 1))
      .all();

    expect(res).toEqual([{ id: 1, name: "John" }]);
  });

  test("insert with onConflict do nothing using composite pk as target", async () => {
    await db
      .insert(pkExampleTable)
      .values({ id: 1, name: "John", email: "john@example.com" })
      .run();

    await db
      .insert(pkExampleTable)
      .values({ id: 1, name: "John", email: "john1@example.com" })
      .onConflictDoNothing({ target: [pkExampleTable.id, pkExampleTable.name] })
      .run();

    const res = await db
      .select({
        id: pkExampleTable.id,
        name: pkExampleTable.name,
        email: pkExampleTable.email,
      })
      .from(pkExampleTable)
      .where(eq(pkExampleTable.id, 1))
      .all();

    expect(res).toEqual([{ id: 1, name: "John", email: "john@example.com" }]);
  });

  test("insert with onConflict do update", async () => {
    await db.insert(usersTable).values({ id: 1, name: "John" }).run();

    await db
      .insert(usersTable)
      .values({ id: 1, name: "John" })
      .onConflictDoUpdate({ target: usersTable.id, set: { name: "John1" } })
      .run();

    const res = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, 1))
      .all();

    expect(res).toEqual([{ id: 1, name: "John1" }]);
  });

  test("insert with onConflict do update using composite pk", async () => {
    await db
      .insert(pkExampleTable)
      .values({ id: 1, name: "John", email: "john@example.com" })
      .run();

    await db
      .insert(pkExampleTable)
      .values({ id: 1, name: "John", email: "john@example.com" })
      .onConflictDoUpdate({
        target: [pkExampleTable.id, pkExampleTable.name],
        set: { email: "john1@example.com" },
      })
      .run();

    const res = await db
      .select({
        id: pkExampleTable.id,
        name: pkExampleTable.name,
        email: pkExampleTable.email,
      })
      .from(pkExampleTable)
      .where(eq(pkExampleTable.id, 1))
      .all();

    expect(res).toEqual([{ id: 1, name: "John", email: "john1@example.com" }]);
  });

  test("insert undefined", async () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name"),
    });

    await db.run(sql`drop table if exists ${users}`);

    await db.run(
      sql`create table ${users} (id integer primary key, name text)`
    );

    await expect(
      db.insert(users).values({ name: undefined }).run()
    ).resolves.not.toThrow();

    await db.run(sql`drop table ${users}`);
  });

  test.skip("update undefined", async () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name"),
    });

    await db.run(sql`drop table if exists ${users}`);

    await db.run(
      sql`create table ${users} (id integer primary key, name text)`
    );

    await expect(
      db.update(users).set({ name: undefined }).run()
    ).rejects.toThrow();
    await expect(
      db.update(users).set({ id: 1, name: undefined }).run()
    ).resolves.not.toThrow();

    await db.run(sql`drop table ${users}`);
  });

  test("async api - CRUD", async () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name"),
    });

    await db.run(sql`drop table if exists ${users}`);

    await db.run(
      sql`create table ${users} (id integer primary key, name text)`
    );

    await db.insert(users).values({ id: 1, name: "John" });

    const res = await db.select().from(users);

    expect(res).toEqual([{ id: 1, name: "John" }]);

    await db.update(users).set({ name: "John1" }).where(eq(users.id, 1));

    const res1 = await db.select().from(users);

    expect(res1).toEqual([{ id: 1, name: "John1" }]);

    await db.delete(users).where(eq(users.id, 1));

    const res2 = await db.select().from(users);

    expect(res2).toEqual([]);

    await db.run(sql`drop table ${users}`);
  });

  test("async api - insert + select w/ prepare + async execute", async () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name"),
    });

    await db.run(sql`drop table if exists ${users}`);

    await db.run(
      sql`create table ${users} (id integer primary key, name text)`
    );

    const insertStmt = db
      .insert(users)
      .values({ id: 1, name: "John" })
      .prepare();
    await insertStmt.execute();

    const selectStmt = db.select().from(users).prepare();
    const res = await selectStmt.execute();

    expect(res).toEqual([{ id: 1, name: "John" }]);

    const updateStmt = db
      .update(users)
      .set({ name: "John1" })
      .where(eq(users.id, 1))
      .prepare();
    await updateStmt.execute();

    const res1 = await selectStmt.execute();

    expect(res1).toEqual([{ id: 1, name: "John1" }]);

    const deleteStmt = db.delete(users).where(eq(users.id, 1)).prepare();
    await deleteStmt.execute();

    const res2 = await selectStmt.execute();

    expect(res2).toEqual([]);

    await db.run(sql`drop table ${users}`);
  });

  // test("async api - insert + select w/ prepare + sync execute", async () => {
  //   const users = sqliteTable("users", {
  //     id: integer("id").primaryKey(),
  //     name: text("name"),
  //   });
  //
  //   await db.run(sql`drop table if exists ${users}`);
  //
  //   await db.run(
  //     sql`create table ${users} (id integer primary key, name text)`
  //   );
  //
  //   const insertStmt = db
  //     .insert(users)
  //     .values({ id: 1, name: "John" })
  //     .prepare();
  //   insertStmt.execute().sync();
  //
  //   const selectStmt = db.select().from(users).prepare();
  //   const res = selectStmt.execute().sync();
  //
  //   expect(res).toEqual([{ id: 1, name: "John" }]);
  //
  //   const updateStmt = db
  //     .update(users)
  //     .set({ name: "John1" })
  //     .where(eq(users.id, 1))
  //     .prepare();
  //   updateStmt.execute().sync();
  //
  //   const res1 = selectStmt.execute().sync();
  //
  //   expect(res1).toEqual([{ id: 1, name: "John1" }]);
  //
  //   const deleteStmt = db.delete(users).where(eq(users.id, 1)).prepare();
  //   deleteStmt.execute().sync();
  //
  //   const res2 = selectStmt.execute().sync();
  //
  //   expect(res2).toEqual([]);
  //
  //   await db.run(sql`drop table ${users}`);
  // });

  test.skip("select + .get() for empty result", async () => {
    const users = sqliteTable("users", {
      id: integer("id").primaryKey(),
      name: text("name"),
    });

    await db.run(sql`drop table if exists ${users}`);

    await db.run(
      sql`create table ${users} (id integer primary key, name text)`
    );

    const res = await db.select().from(users).where(eq(users.id, 1)).get();

    expect(res).toBeUndefined();

    await db.run(sql`drop table ${users}`);
  });
});
