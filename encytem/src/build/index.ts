import * as esbuild from "esbuild";
import * as fs from "fs/promises";
import * as minifier from "html-minifier";

await new Promise((resolve) => setTimeout(resolve, 500));

const outputFolder = "/output";

const isProduction = process.env["DEV"] === "false";
const commitHash = process.env["COMMIT_HASH"] || "unknown";
const linesCount = parseInt(process.env["LINES_COUNT"] || "", 10) || 0;
console.info("Building for", isProduction ? "production" : "debug");

await (await import("./compile-enums" + ".mjs")).doEnumCompilation();
await Promise.all(
  (
    await fs.readdir(outputFolder)
  ).map((entry) =>
    fs.rm(`${outputFolder}/${entry}`, { recursive: true }).catch((e) => void e)
  )
);

const entryPoints = [
  "main",
  "network-worker",
  "update-worker",
  "render-worker",
  "render-helper-worker",
  "feature-environments/zero",
  "feature-environments/first",
  "feature-environments/second",
] as const;

const defines = {
  _C_DEBUG: JSON.stringify(!isProduction),
  _C_JS_ROOT: JSON.stringify(``),
  _C_COMMIT_HASH: JSON.stringify(commitHash),
  _C_CODE_STATS_LINES_COUNT: JSON.stringify(linesCount),
} as const;

const ctx = await esbuild.context({
  define: defines,
  allowOverwrite: true,
  entryPoints: [
    ...entryPoints.map((name) => `src/main/entry-points/${name}.ts`),
  ],
  bundle: true,
  treeShaking: isProduction,
  sourcemap: isProduction ? false : "inline",
  outdir: outputFolder,
  target: "es2022",
  splitting: false,
  format: "esm",
});

if (!isProduction) {
  await ctx.watch({});
}

const { errors } = await ctx.rebuild();
if (errors.length > 0) {
  console.error(errors);
} else {
  console.info("Build finished successfully");
}

if (isProduction) {
  const excludedProperties = (
    await fs.readFile("./src/build/exclude-from-mangling.txt", {
      encoding: "utf8",
    })
  )
    .split("\n")
    .map((e) => e.trim());

  const result = await esbuild.build({
    entryPoints: entryPoints.map((e) => `${outputFolder}/${e}.js`),
    minify: true,
    outdir: outputFolder,
    treeShaking: true,
    allowOverwrite: true,
    format: "esm",
    mangleProps: /./,
    mangleCache: {
      ...Object.fromEntries(excludedProperties.map((e) => [e, false])),
    },
  });
  if (result.errors.length > 0) {
    console.error("Errors!", result.errors);
    process.exit(1);
  }

  await fs.writeFile(
    `${outputFolder}/.mappings.txt`,
    JSON.stringify(result.mangleCache, undefined, 3)
  );

  await esbuild.build({
    entryPoints: [`${outputFolder}/main.css`],
    minify: true,
    outdir: outputFolder,
    allowOverwrite: true,
  });

  const createNameGenerator = () => {
    const mappings = new Map();
    const allowedAsFirstChar = "qwertyuiopasdfghjklzxcvbnm";
    const allowedAsFirstCharLength = allowedAsFirstChar.length;
    const allowedAsFollowingChar = allowedAsFirstChar + "1234567890-";
    const allowedAsFollowingCharLength = allowedAsFollowingChar.length;

    const generateClassName = (number: number): string => {
      if (number < allowedAsFirstCharLength) return allowedAsFirstChar[number]!;

      return (
        generateClassName((number / allowedAsFollowingCharLength) | 0) +
        allowedAsFollowingChar[number % allowedAsFollowingCharLength]
      );
    };
    return (className: string) => {
      let mapping = mappings.get(className);
      if (!mapping) {
        mapping = generateClassName(mappings.size);
        mappings.set(className, mapping);
      }
      return mapping;
    };
  };

  const transformNames = (
    source: string,
    prefix: string,
    postfix: RegExp | null,
    getNameFor: (n: string) => string
  ) => {
    const prefixLength = prefix.length;
    const outputCode = [];

    let index = 0;
    while (true) {
      const newIndex = source.indexOf(prefix, index);
      if (newIndex < 0) {
        outputCode.push(source.substring(index));
        break;
      }

      let mapping;
      let className;
      if (!postfix) {
        const quot = source.charAt(newIndex - 1);
        className = source.substring(
          newIndex + prefixLength,
          source.indexOf(quot, newIndex + prefixLength)
        );
        mapping = getNameFor(className);
      } else {
        className = source.substring(
          newIndex + prefixLength,
          source.substring(newIndex).search(postfix) + newIndex
        );
        mapping = getNameFor(className);
      }

      outputCode.push(source.substring(index, newIndex));
      outputCode.push(mapping);
      index = newIndex + prefixLength + className.length;
    }
    return outputCode.join("");
  };

  const getNames = async (currentPath: string) => {
    const names: string[] = [];

    for await (const dirEntry of await fs.readdir(currentPath, {
      withFileTypes: true,
    })) {
      const entryPath = `${currentPath}/${dirEntry.name}`;

      if (dirEntry.isDirectory()) {
        names.push(...(await getNames(entryPath)));
      } else if (entryPath.endsWith(".css") || entryPath.endsWith(".js")) {
        names.push(entryPath);
      }
    }

    return names;
  };

  const files = await Promise.all(
    (
      await getNames(outputFolder)
    ).map(async (name) => {
      const content = await fs.readFile(name, { encoding: "utf8" });
      return { name, content };
    })
  );

  const generator = createNameGenerator();
  files.forEach(
    (f) =>
      (f.content = transformNames(
        f.content,
        "_css_",
        f.name.endsWith(".css") ? /[\):\.{ >,]/gi : /['"` ]/gi,
        generator
      ))
  );
  await Promise.all(
    files.map(({ name, content }) =>
      fs.writeFile(name, content, { encoding: "utf8" })
    )
  );
}

await Promise.all(
  (
    await fs.readdir("src/public", { withFileTypes: true })
  ).map(async (entry) => {
    if (entry.name.endsWith(".html") && entry.isFile()) {
      const content = await fs.readFile(`src/public/${entry.name}`, {
        encoding: "utf-8",
      });
      const newContent = minifier.minify(content, {
        collapseBooleanAttributes: true,
        collapseInlineTagWhitespace: true,
        collapseWhitespace: true,
        minifyURLs: true,
        minifyCSS: true,
        minifyJS: true,
        removeAttributeQuotes: true,
        removeEmptyAttributes: true,
        removeComments: true,
        removeOptionalTags: true,
        removeRedundantAttributes: true,
        sortAttributes: true,
        sortClassName: true,
        trimCustomFragments: true,
        useShortDoctype: true,
      });
      await fs.writeFile(`${outputFolder}/${entry.name}`, newContent, {
        encoding: "utf-8",
      });
    } else {
      await fs.cp(`src/public/${entry.name}`, `${outputFolder}/${entry.name}`, {
        recursive: true,
        preserveTimestamps: false,
      });
    }
  })
);
