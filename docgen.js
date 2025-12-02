// scripts/generate-docs.mjs
import fs from "fs-extra";
import path from "path";
import { glob } from "glob";
import jsdoc2md from "jsdoc-to-markdown";

const SRC_DIR = path.resolve("dist");
const OUT_DIR = path.resolve("docs");
const OUT_DIR_CLASS = path.resolve("docs/class");
const OUT_DIR_FUNCTIONS = path.resolve("docs/functions");

async function generateDocs() {
    await fs.emptyDir(OUT_DIR);
    await fs.mkdir(OUT_DIR_CLASS);
    await fs.mkdir(OUT_DIR_FUNCTIONS);
    const files = await glob(`${SRC_DIR}/**/*.js`);

    for (const file of files) {
        const templateData = jsdoc2md.getTemplateDataSync({ files: file });

        const classes = templateData.filter((d) => d.kind === "class");
        const topLevelFunctions = templateData.filter(
            (d) => d.kind === "function" && !d.memberof,
        );

        // --- Classes ---
        for (const cls of classes) {
            const members = templateData.filter(
                (d) =>
                    d.memberof === cls.name &&
                    (d.kind === "function" || d.kind === "member"),
            );

            let markdown = `# ${cls.name}\n\n${cls.description || ""}\n\n`;

            // instance + static methods
            for (const fn of members.filter((m) => m.kind === "function")) {
                markdown += `## ${fn.name}()\n\n`;
                if (fn.description) markdown += `${fn.description}\n\n`;

                if (fn.params?.length) {
                    markdown += `**Parameters:**\n`;
                    for (const p of fn.params) {
                        const type = p.type?.names?.join("|") || "any";
                        markdown += `- \`${p.name}\` *(${type})* — ${p.description || ""}\n`;
                    }
                    markdown += "\n";
                }

                if (fn.returns?.length) {
                    markdown += `**Returns:** ${fn.returns
                        .map((r) => r.type?.names?.join("|"))
                        .join(", ")}\n\n`;
                }
            }

            // class members / properties
            const props = members.filter((m) => m.kind === "member");
            if (props.length) {
                markdown += `## Properties\n\n`;
                for (const p of props) {
                    markdown += `- \`${p.name}\` — ${p.description || ""}\n`;
                }
                markdown += "\n";
            }

            const outFile = path.join(OUT_DIR_CLASS, `${cls.name}.md`);
            await fs.writeFile(outFile, markdown);
            console.log(`Wrote class docs: ${outFile}`);
        }

        // --- Top-level functions ---
        for (const fn of topLevelFunctions) {
            let markdown = `# ${fn.name}\n\n${fn.description || ""}\n\n`;

            if (fn.params?.length) {
                markdown += `**Parameters:**\n`;
                for (const p of fn.params) {
                    const type = p.type?.names?.join("|") || "any";
                    markdown += `- \`${p.name}\` *(${type})* — ${p.description || ""}\n`;
                }
                markdown += "\n";
            }

            if (fn.returns?.length) {
                markdown += `**Returns:** ${fn.returns
                    .map((r) => r.type?.names?.join("|"))
                    .join(", ")}\n\n`;
            }

            const outFile = path.join(OUT_DIR_FUNCTIONS, `${fn.name}.md`);
            await fs.writeFile(outFile, markdown);
            console.log(`Wrote function docs: ${outFile}`);
        }
    }
}

generateDocs().catch((err) => {
    console.error(err);
    process.exit(1);
});
