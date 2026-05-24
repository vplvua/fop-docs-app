#!/usr/bin/env node
import { hash, Algorithm } from "@node-rs/argon2";

const PARAMS = { algorithm: Algorithm.Argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };

function readTtySecret(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let buf = "";
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "") {
          stdin.setRawMode(false);
          process.stderr.write("\n");
          process.exit(130);
        }
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stderr.write("\n");
          resolve(buf);
          return;
        }
        if (c === "" || c === "\b") {
          buf = buf.slice(0, -1);
        } else {
          buf += c;
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function readPipedSecret() {
  let buf = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) buf += chunk;
  return buf.replace(/\r?\n$/, "");
}

const interactive = process.stdin.isTTY;
let pw;
if (interactive) {
  pw = await readTtySecret("Password: ");
  if (!pw) {
    process.stderr.write("empty password — aborting\n");
    process.exit(1);
  }
  const confirm = await readTtySecret("Confirm:  ");
  if (pw !== confirm) {
    process.stderr.write("passwords do not match\n");
    process.exit(1);
  }
} else {
  pw = await readPipedSecret();
  if (!pw) {
    process.stderr.write("empty password on stdin — aborting\n");
    process.exit(1);
  }
}

const digest = await hash(pw, PARAMS);
process.stdout.write(digest + "\n");
