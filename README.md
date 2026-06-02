# prisma-js-defaults

[![npm version](https://img.shields.io/npm/v/prisma-js-defaults.svg?style=flat-square)](https://www.npmjs.com/package/prisma-js-defaults)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A zero-dependency, context-aware Prisma extension that allows you to use custom JavaScript/TypeScript functions to generate default values for your database fields dynamically at runtime.

## What's new in v2.1.0? (Stability & Deep Cloning Update)

Version 2.1.0 brings massive improvements to runtime safety, memory management, and complete support for complex Prisma data types and nested update trees.

### Smarter & Hardened deepClone
* **Prisma Ecosystem Types:** Fixed bugs where specialized Prisma fields would lose their instances during query arguments cloning. Now fully supports `Prisma.Decimal`, `Prisma.DbNull`, `Prisma.JsonNull`, and `Prisma.AnyNull` without breaking their internal structures.
* **Native Type Support:** Added seamless deep cloning for JavaScript `Date` and Node.js `Buffer` objects.
* **Circular Reference Protection:** Upgraded the cloning engine with a `WeakMap` registry. If your query payload contains circular references, the extension safely handles them instead of throwing a `RangeError: Maximum call stack size exceeded` crash.

### Traversal for Top-Level update Operations
* **Nested Writes inside Updates:** The extension now intercepts top-level update queries. While it intentionally skips applying defaults to fields being directly `updated` (preserving your data integrity), it now recursively traverses nested relation trees inside the update payload. 
* This means nested `create`, `createMany`, `connectOrCreate`, or `upsert` queries triggered inside a parent `update` will now correctly receive their dynamic JS defaults.

## Why this exists?

Prisma currently doesn't allow using custom JavaScript/TypeScript functions directly inside the `@default()` attribute in your `schema.prisma` file. This package solves that by introducing a custom `/// @defaultJs` comment decorator and a lightweight runtime extension.

## Installation

```bash
npm install prisma-js-defaults
```

*(Note: Requires `@prisma/client` v4.0.0 or higher. The examples below use Prisma v7 syntax and Driver Adapters).*

## Usage

### 1. Update your `schema.prisma`

Add the `/// @defaultJs(yourFunctionName)` comment directly above the field you want to generate dynamically.

> **TypeScript Tip:** Add a native Prisma default like `@default("")` to satisfy the TypeScript compiler. Your database won't use it because `prisma-js-defaults` will inject the real value at runtime before the query executes.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model Article {
  id Int @id @default(autoincrement())
  title String
  
  // Use @default("") so TypeScript doesn't complain during creation
  /// @defaultJs(generateSlug)
  slug String @default("")
}
```

### 2. Generate the configuration

Run the CLI tool to parse your schema and generate the internal configuration file (`js-defaults.json`):

```bash
npx prisma-js-defaults
```

*(This command will automatically run `npx prisma generate` for you afterwards.)*

### 3. Setup the Prisma Extension

In your backend code, wrap your Prisma Client with the withJsDefaults extension. You need to pass the generated config as the first argument, and your functions as the second. Here is an example:
```typescript
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { withJsDefaults } from 'prisma-js-defaults';

// 1. Import the generated configuration
import { jsDefaultsConfig } from '../prisma/generated/js-defaults';

// 2. Initialize your Driver Adapter
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// 3. Apply the extension to your Prisma Client
const prisma = new PrismaClient({ adapter }).$extends(
    withJsDefaults(jsDefaultsConfig, {
        // The generator receives the current data object.
        // You can use it to create contextual defaults!
        generateSlug: (data) => {
            if (data?.title) {
                return data.title.toLowerCase().replace(/\s+/g, '-');
            }
            return "fallback-slug-" + Date.now();
        }
    })
);

async function main() {
    // The slug will be generated automatically based on the title!
    const article = await prisma.article.create({
        data: {
            title: "Hello Awesome World"
        }
    });

    console.log(article.slug);
    // Output: hello-awesome-world
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
```

## Supported Operations

`prisma-js-defaults` deeply traverses your queries and applies defaults to:
* `create`
* `createMany`
* `createManyAndReturn`
* `upsert` (applies to the `create` branch only)
* Nested relational writes (`create`, `createMany`, `connectOrCreate`, `upsert` within includes)
* Nested relation trees inside `update` operations (applies to nested creations like `create`, `createMany`, `connectOrCreate`, or `upsert.create`).

*Note: Top-level fields inside update actions are never modified, ensuring existing data isn't accidentally overwritten by default values.*

***Interactive Transactions:** Fully supported out of the box. The extension seamlessly handles queries executed inside `$transaction(async (tx) => { ... })` blocks without any additional configuration.*

## Advanced: Async Functions
Your generator functions can be completely asynchronous! This is incredibly powerful if your default value depends on an external API, database lookup, or heavy cryptographic hashing.
```typescript
const prisma = new PrismaClient().$extends(
    withJsDefaults(jsDefaultsConfig, {
        generateSlug: async (data) => {
            // Fetch some external data or hash before inserting!
            const uniqueHash = await fetchSomeExternalApi();
            return `${data.title}-${uniqueHash}`;
        }
    })
);
```

## Important Architecture Notes

### 1. Extension Order (Middleware Pipeline)
Prisma executes extensions in the order they are chained. If you are using multiple extensions that modify `args.data` on queries, the order matters:
* Place `withJsDefaults` **last** if you want it to run after other extensions have formatted your data.
* Place `withJsDefaults` **first** if you want subsequent extensions to validate or log the defaults generated by your functions.

### 2. `@defaultJs()` vs native `@default()`
If a field in your schema has both a Prisma native default and a JS default (e.g., `id String @default(uuid()) /// @defaultJs(myGenerator)`), the **`@defaultJs` will always win**.
This is because `prisma-js-defaults` injects the value at the runtime query level, skipping the database-level default generation entirely.

## License

MIT
