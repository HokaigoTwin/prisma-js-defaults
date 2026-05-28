# prisma-js-defaults

A zero-dependency, context-aware Prisma extension that allows you to use custom JavaScript/TypeScript functions to generate default values for your database fields dynamically at runtime.

## What's new in v2.0.0? (Major Architecture Overhaul)

Version 2.0.0 is a complete rewrite focused on enterprise-grade stability, developer experience (DX), and performance.

### Core Engine & Parsing
* **AST-Based Parsing:** Replaced fragile RegEx parsing with Prisma's internal `getDMMF`. The parser now perfectly handles complex formatting, comments, and empty lines without breaking.
* **Multi-file Schema Support:** Automatically traverses and recursively merges all `.prisma` files in custom or default directory structures.
* **Edge Runtime & Monorepo Compatibility:** Completely removed runtime `fs.readFileSync` calls. The extension now relies entirely on a pre-generated static configuration, eliminating hot-reloading crashes and Edge environment blockers.

### Developer Experience (DX) & Type Safety
* **Strict Autocomplete:** Automatically generates exact TypeScript union types for your required generator functions. No more "blind" typing—your IDE will catch missing or misspelled function names at compile time.
* **Contextual Generators:** Generator functions now receive the current `data` object payload as an argument, enabling derived defaults (e.g., dynamically generating a `slug` based on a provided `title`).
* **Friendly Error Tracing:** User-provided functions are now wrapped in isolated `try/catch` blocks. If your custom logic fails, the extension throws a clear, developer-readable error instead of an obscure database crash.

### Runtime Stability & Security
* **Zero Side-Effects (Immutability):** Implemented strict deep cloning (`deepClone`) to guarantee that your original input objects are never mutated during traversal.
* **Hardened Security:** Secured the internal configuration dictionaries against Prototype Pollution vulnerabilities by utilizing prototype-less objects (`Object.create(null)`).
* **Safe Traversal:** Added robust runtime checks (`if (args?.data)`, `if (!dataObj)`) to completely prevent `Cannot read properties of undefined` crashes during malformed or empty queries.

### Expanded Database Operations
* **Parallel Execution:** Switched to concurrent execution (`Promise.all`) for all generator functions, significantly reducing database query latency when processing multiple defaults.
* **Deeply Nested Writes:** Full support for deeply nested relational queries (`create`, `createMany`, `connectOrCreate`, and `upsert` within includes).
* **Batch Operations:** Added full support for `createMany`, `createManyAndReturn`, and `upsert` (applies to the `create` branch).

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

*Note: `update` operations are intentionally ignored, as defaults should only be applied upon record creation.*

## Important Architecture Notes

### 1. Extension Order (Middleware Pipeline)
Prisma executes extensions in the order they are chained. If you are using multiple extensions that modify `args.data` on queries, the order matters:
* To ensure your defaults are applied **after** other extensions format the data, place `withJsDefaults` **last** in the chain.
* To allow other extensions to format or validate the defaults generated by your functions, place `withJsDefaults` **first**.

### 2. `@defaultJs()` vs native `@default()`
If a field in your schema has both a Prisma native default and a JS default (e.g., `id String @default(uuid()) /// @defaultJs(myGenerator)`), the **`@defaultJs` will always win**.
This is because `prisma-js-defaults` injects the value at the runtime query level, skipping the database-level default generation entirely.

## License

MIT