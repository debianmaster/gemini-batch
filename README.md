# Gemini-Batch

A TypeScript CLI tool for managing batch processing jobs with Google Gemini API.

**Use cases:**
- Batch content tagging and classification
- Large-scale file translation
- Bulk text analysis and processing

Learn more about [Gemini Batch Mode](https://ai.google.dev/gemini-api/docs/batch-mode).

## Installation

```bash
npm install -g gemini-batch
```

## Quick Start

1. **Configure your API key:**

```bash
gemini-batch config set-key your-gemini-key

# or
export GEMINI_API_KEY="your-gemini-key"

# or
export GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-key"
```

2. **Create a input file:**

```bash
gemini-batch file create --prompt "translate this file to Chinese" --input blog/*.md --output batch.jsonl
```

3. **Submit batch jobs:**

```bash
gemini-batch job submit batch.jsonl
```

4. **Check job status and download results:**

```bash
gemini-batch job list
gemini-batch job download your-job-id
```

For detailed usage, run `gemini-batch --help` or `gemini-batch <command> --help`.


## License

MIT
