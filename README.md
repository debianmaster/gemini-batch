# Poly-Batch

A TypeScript CLI tool for managing batch processing jobs across multiple AI providers (OpenAI, Gemini, and Anthropic).

## Features

- 🚀 **Multi-Provider Support**: Works with OpenAI, Google Gemini, and Anthropic (when available)
- 📁 **Batch Processing**: Process multiple JSONL files concurrently
- ⚙️ **Configurable**: Flexible configuration for API keys, models, and processing parameters
- 📊 **Progress Tracking**: Real-time status updates and job monitoring
- 🎨 **Beautiful CLI**: Colored output and intuitive command interface

## Installation

```bash
npm install -g poly-batch
# or
pnpm add -g poly-batch
```

## Quick Start

1. **Configure your API keys:**

```bash
poly-batch configure --set-openai-key your-openai-key
poly-batch configure --set-gemini-key your-gemini-key
```

2. **Process batch files:**

```bash
poly-batch process input.jsonl --provider openai
poly-batch process ./input-folder/ --provider gemini --output ./results
```

## Commands

### `process <inputs...>`

Process batch jobs from input files or directories.

```bash
poly-batch process input1.jsonl input2.jsonl --provider openai
poly-batch process ./batch-files/ --provider gemini --output ./results
```

**Options:**
- `--provider <provider>`: AI provider (openai, gemini, anthropic) [default: openai]
- `--output <dir>`: Output directory [default: ./results]
- `--max-concurrent <num>`: Maximum concurrent jobs [default: 5]
- `--check-interval <seconds>`: Status check interval [default: 5]

### `configure`

Manage configuration settings.

```bash
# Set API keys
poly-batch configure --set-openai-key sk-...
poly-batch configure --set-gemini-key your-gemini-key

# Set models
poly-batch configure --set-openai-model gpt-4
poly-batch configure --set-gemini-model gemini-2.0-flash-exp

# Show current config
poly-batch configure --show

# Reset to defaults
poly-batch configure --reset
```

### `list [provider]`

List recent batch jobs.

```bash
poly-batch list openai
poly-batch list --limit 50
```

### `cancel <job-id> <provider>`

Cancel a specific batch job.

```bash
poly-batch cancel batch_123 openai
```

## Supported Providers

### OpenAI
- ✅ Batch API support
- ✅ File upload and download
- ✅ Job monitoring and cancellation
- **Default Model**: `gpt-3.5-turbo`

### Google Gemini
- ✅ Batch API support
- ✅ File upload and processing
- ✅ Job monitoring
- **Default Model**: `gemini-2.0-flash-exp`

### Anthropic
- ⏳ Coming soon (Anthropic batch API not yet available)
- **Default Model**: `claude-3-5-sonnet-20241022`

## Environment Variables

You can also set API keys via environment variables:

```bash
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="your-gemini-key"
export GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-key"  # Alternative
export ANTHROPIC_API_KEY="your-anthropic-key"
```

## Input Format

Input files should be in JSONL format where each line is a JSON object representing a batch request.

**Example for OpenAI:**
```jsonl
{"custom_id": "request-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello, world!"}]}}
{"custom_id": "request-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "How are you?"}]}}
```

**Example for Gemini:**
```jsonl
{"custom_id": "request-1", "contents": [{"role": "user", "parts": [{"text": "Hello, world!"}]}]}
{"custom_id": "request-2", "contents": [{"role": "user", "parts": [{"text": "How are you?"}]}]}
```

## Configuration

Configuration is stored in `~/.poly-batch/config.json`. You can edit this file directly or use the `configure` command.

```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-3.5-turbo"
    },
    "gemini": {
      "apiKey": "your-key",
      "model": "gemini-2.0-flash-exp"
    }
  },
  "maxConcurrentJobs": 5,
  "checkInterval": 5
}
```

## Development

```bash
# Clone the repository
git clone <repo-url>
cd poly-batch

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run in development mode
pnpm run dev

# Link for local testing
pnpm link --global
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
