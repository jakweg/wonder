import { spawn } from "child_process";
import * as fs from "fs/promises";

const runProcess = (command: string[], cwd?: string): Promise<void> => {
  const stdio = "ignore" as "inherit" | "ignore";
  const [cmd, ...args] = command;
  const process = spawn(cmd, args, { cwd, stdio });
  return new Promise((resolve, reject) => {
    process.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject("Process " + command.join(" ") + " failed")
    );
  });
};

const findFiles = async (src: string, condition: (name: string) => boolean) => {
  const found: string[] = [];
  for (const dirEntry of await fs.readdir(src, { withFileTypes: true })) {
    if (dirEntry.isDirectory()) {
      found.push(...(await findFiles(`${src}/${dirEntry.name}`, condition)));
    } else if (dirEntry.isFile()) {
      if (condition(dirEntry.name)) {
        found.push(`${src}/${dirEntry.name}`);
      }
    }
  }
  return found;
};

const newCompiledContent = () => ({
  _content: [] as string[],
  _import_counter: 0,
  addImport(fileName: string, propertyName: string): string {
    const name = `imported_${this._import_counter++}`;
    if (propertyName) {
      this._content.unshift(
        "import * as ",
        name,
        " from ",
        JSON.stringify(fileName),
        ";"
      );
    } else {
      this._content.unshift(
        "import ",
        name,
        " from ",
        JSON.stringify(fileName),
        ";"
      );
    }
    return name;
  },
  push(line: string) {
    this._content.push(line);
  },
  finalize(): string {
    return this._content.join("");
  },
});

const transformFile = async (fileName: string) => {
  const compiledContent = newCompiledContent();

  const description = JSON.parse(
    await fs.readFile(fileName, { encoding: "utf8" })
  );

  compiledContent._content.unshift(`
  /*
  * THIS FILE WAS AUTOGENERATED, DO NOT CHANGE IT
  * Any change you make here will be overwritten by a compiler
  * edit appropriate .2bc.json file instead
  */
 `);
  compiledContent.push(`export const enum `);
  compiledContent.push(description.name);
  compiledContent.push("{");

  for (const [parentName, children] of Object.entries(description.values)) {
    if (parentName.startsWith("#")) {
      for (const name of Object.keys((children as any).values)) {
        compiledContent.push(parentName.substring(1));
        compiledContent.push("_");
        compiledContent.push(name);
        compiledContent.push(",");
      }
    } else {
      compiledContent.push(parentName);
      compiledContent.push(",");
    }
  }
  if (description["add-size"] === true) compiledContent.push("SIZE,");
  compiledContent.push("};");

  for (const [getterName, getter] of Object.entries(
    description.getters ?? {}
  )) {
    compiledContent.push(`export const `);
    compiledContent.push(getterName);
    compiledContent.push(" = (value: ");
    compiledContent.push(description.name);
    compiledContent.push(") => { ");
    compiledContent.push(`/* This file was autogenerated, don't change */\n`);
    compiledContent.push(" switch (value) {");
    for (const [parentEnumName, values] of Object.entries(description.values)) {
      const appendCaseForEnum = (
        name: string,
        value: any,
        importPrefix: string
      ) => {
        compiledContent.push("case ");
        compiledContent.push(description.name);
        compiledContent.push(".");
        compiledContent.push(name);
        compiledContent.push(": return ");
        if (value === undefined)
          throw new Error(
            `Value is missing for getter ${getterName} for enum ${name}`
          );
        if (typeof value === "string")
          compiledContent.push(JSON.stringify(value));
        else if (typeof value === "number")
          compiledContent.push(JSON.stringify(value));
        else if (typeof value === "boolean")
          compiledContent.push(JSON.stringify(value));
        else if (typeof value === "object" && fieldName.startsWith("@")) {
          const name = compiledContent.addImport(
            importPrefix + value["from"],
            value["property"]
          );
          compiledContent.push(name);
          if (value["property"]) {
            compiledContent.push(".");
            compiledContent.push(value["property"]);
          }
        } else throw new Error("Invalid field type");
        compiledContent.push(";");
      };

      const fieldName = (getter as any).field;
      if (parentEnumName.startsWith("#")) {
        const importPrefix = (values as any)["import-prefix"];
        for (const [childEnumName, childValues] of Object.entries(
          (values as any).values
        )) {
          appendCaseForEnum(
            `${parentEnumName.substring(1)}_${childEnumName}`,
            (childValues as any)[fieldName],
            importPrefix || ""
          );
        }
      } else appendCaseForEnum(parentEnumName, (values as any)[fieldName], "");
    }

    switch ((getter as any)["if-invalid-enum"] ?? "throw") {
      case "throw":
        compiledContent.push("default: throw new Error();");
        break;
      case "return-null":
        compiledContent.push("default: return null;");
        break;
      case "return-undefined":
        compiledContent.push("default: return undefined;");
        break;
    }

    compiledContent.push("}};");
  }

  const finalName =
    description["output-file"] ||
    fileName.substring(
      fileName.lastIndexOf("/") + 1,
      fileName.indexOf(".", fileName.lastIndexOf("/") + 1)
    );
  const finalPath =
    fileName.substring(0, fileName.lastIndexOf("/")) + "/" + finalName + ".ts";
  await fs.writeFile(finalPath, compiledContent.finalize(), {
    encoding: "utf8",
  });
  try {
    await runProcess(["npx", "--no-install", "prettier", "--write", finalPath]);
  } catch (e) {
    // ignore, probably npx or prettier not found
  }
};

export const doEnumCompilation = async () => {
  const candidates = await findFiles("src", (name) =>
    name.endsWith(".2bc.json")
  );
  await Promise.all(candidates.map((name) => transformFile(name)));
};