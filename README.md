# prisma-js-defaults

A zero-dependency Prisma extension that allows you to use custom JavaScript/TypeScript functions to generate default values for your database fields.

## Why this exists?

Prisma currently doesn't allow using custom JavaScript/TypeScript functions directly inside the `@default()` attribute in your `schema.prisma` file, which is quite inconvenient. This package solves that by introducing a custom `/// @defaultJs` comment decorator and a lightweight runtime extension.
## Installation

```bash
npm install prisma-js-defaults
```

*(Note: Requires `@prisma/client` v4.0.0 or higher)*

## Usage

### 1. Update your `schema.prisma`

Add the `/// @defaultJs(yourFunctionName)` comment directly above the field you want to generate dynamically.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Article {
  id    Int    @id @default(autoincrement())
  title String
  
  /// @defaultJs(generateSlug)
  slug  String
}
```

### 2. Generate the configuration

Run the CLI tool to parse your schema and generate the internal configuration file (`js-defaults.json`):

```bash
npx prisma-js-defaults
```

*(This command will automatically run `npx prisma generate` for you afterwards.)*

### 3. Setup the Prisma Extension

In your backend code, wrap your Prisma Client with the `withJsDefaults` extension and provide your actual functions:

```typescript
import { PrismaClient } from '@prisma/client';
import { withJsDefaults } from 'prisma-js-defaults';

// Pass your custom functions into the extension
const prisma = new PrismaClient().$extends(
    withJsDefaults({
        generateSlug: () => "post-" + Math.random().toString(36).substring(7)
    })
);

async function main() {
    // The slug will be generated automatically!
    const article = await prisma.article.create({
        data: {
            title: "Hello World"
        }
    });
    
    console.log(article.slug); 
    // Output: post-x8z9a2
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
```

## How it works under the hood

1. The CLI command reads your `schema.prisma` and creates a lightweight `js-defaults.json` mapping file.
2. The Prisma extension hooks into the `$allModels.create` operation.
3. If a field has a mapped function and was NOT provided in the `create` query, the extension executes your JavaScript function and injects the result before saving to the database.

## Roadmap & Known Limitations (v1.0.0)

This package is currently under active development. Please keep the following in mind for the `v1.0.0` release:
* **Supported operations:** Currently, only standard `create` operations are supported. 
* **Coming soon:** Support for `createMany`, `upsert`, and complex **nested writes** is planned for upcoming releases.
* **TypeScript constraints:** You might need to mark your dynamically generated fields as optional in your `schema.prisma` (e.g., `slug String?`) or use `// @ts-ignore` to prevent TypeScript from complaining about missing fields during creation.

## License

MIT