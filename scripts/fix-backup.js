const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node fix-backup.js <path-to-backup.json>');
  process.exit(1);
}

// 24-character hex string = MongoDB ObjectId
const isObjectId = (val) => typeof val === 'string' && /^[a-f0-9]{24}$/i.test(val);

// ISO 8601 date string
const isISODate = (val) => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(val);

// Fields that are always ObjectId references, even if they don't look like one
// (null values are kept as null)
const OBJECT_ID_FIELDS = ['_id', 'replyTo'];

function transformDocument(doc) {
  const result = {};

  for (const [key, value] of Object.entries(doc)) {
    if (value === null) {
      result[key] = null;
      continue;
    }

    // Handle ObjectId fields explicitly by field name
    if (OBJECT_ID_FIELDS.includes(key) && isObjectId(value)) {
      result[key] = { $oid: value };
      continue;
    }

    // Handle ISO date strings
    if (isISODate(value)) {
      result[key] = { $date: value };
      continue;
    }

    // Recurse into arrays
    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null ? transformDocument(item) : item
      );
      continue;
    }

    // Recurse into nested objects
    if (typeof value === 'object') {
      result[key] = transformDocument(value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

try {
  const raw = fs.readFileSync(path.resolve(inputFile), 'utf8');
  const documents = JSON.parse(raw);

  if (!Array.isArray(documents)) {
    console.error('Expected a JSON array at the top level. Wrap your documents in [ ] if needed.');
    process.exit(1);
  }

  const transformed = documents.map(transformDocument);

  const outputFile = inputFile.replace(/\.json$/, '') + '-fixed.json';
  fs.writeFileSync(outputFile, JSON.stringify(transformed, null, 2));

  console.log(`Done. ${transformed.length} documents transformed.`);
  console.log(`Output written to: ${outputFile}`);
  console.log(`Import with: mongoimport --uri "<your-uri>" --collection <collection> --file ${outputFile} --jsonArray`);
} catch (err) {
  if (err instanceof SyntaxError) {
    console.error('JSON parse error. Run your file through https://jsonlint.com to find the broken spot.');
  }
  console.error(err.message);
  process.exit(1);
}