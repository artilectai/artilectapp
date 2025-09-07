import { readFileSync, writeFileSync, existsSync } from "fs";

const langs = ["en","ru","uz"];

function deepMergePreferTarget(target, source) {
  if (typeof source !== "object" || source === null) return target;
  if (typeof target !== "object" || target === null) target = Array.isArray(source) ? [] : {};
  for (const key of Object.keys(source)) {
    if (key in target) {
      target[key] = deepMergePreferTarget(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

for (const lng of langs) {
  const srcPath = `src/locales/${lng}/app.json`;
  const pubPath = `public/locales/${lng}/app.json`;

  if (!existsSync(pubPath)) {
    console.error(`Missing ${pubPath}. Skipping ${lng}.`);
    continue;
  }

  const pub = JSON.parse(readFileSync(pubPath, "utf8"));
  const src = existsSync(srcPath) ? JSON.parse(readFileSync(srcPath, "utf8")) : {};

  const fromSrc = {
    auth: {
      login: src?.auth?.login ?? {},
      register: src?.auth?.register ?? {}
    }
  };

  // Ensure objects exist
  pub.auth = pub.auth || {};
  pub.auth.login = pub.auth.login || {};
  pub.auth.register = pub.auth.register || {};

  // Merge: keep existing public keys; fill only missing ones from src
  deepMergePreferTarget(pub, fromSrc);

  writeFileSync(pubPath, JSON.stringify(pub, null, 2) + "\n", "utf8");
  console.log(` Merged auth.login/register for ${lng}`);
}
