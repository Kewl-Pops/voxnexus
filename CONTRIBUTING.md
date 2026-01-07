# Contributing to VoxNexus

Thank you for your interest in contributing to VoxNexus! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker and Docker Compose
- pnpm (package manager)
- uv (Python package manager)

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/voxnexus.git
cd voxnexus

# Add upstream remote
git remote add upstream https://github.com/your-org/voxnexus.git

# Install dependencies
make setup

# Copy environment template
make env

# Start database
make db

# Run development servers
make dev
```

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/your-org/voxnexus/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, versions)

### Suggesting Features

1. Check [Discussions](https://github.com/your-org/voxnexus/discussions) for existing proposals
2. Open a new discussion with:
   - Problem statement
   - Proposed solution
   - Alternatives considered

### Pull Requests

1. Fork and create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our coding standards

3. Write/update tests as needed

4. Run the test suite:
   ```bash
   make test
   make lint
   ```

5. Commit with clear messages:
   ```bash
   git commit -m "feat: add support for custom TTS provider"
   ```

6. Push and open a PR:
   ```bash
   git push origin feature/your-feature-name
   ```

## Coding Standards

### Python (Worker)

- Follow PEP 8 style guide
- Use type hints for all functions
- Format with `ruff format`
- Lint with `ruff check`
- Type check with `mypy`

```python
async def process_audio(
    self,
    audio_stream: AsyncIterator[AudioFrame],
) -> AsyncIterator[AudioFrame]:
    """Process incoming audio and generate responses.

    Args:
        audio_stream: Iterator of audio frames from the user.

    Yields:
        Audio frames containing the agent's response.
    """
    ...
```

### TypeScript (Web)

- Use TypeScript strict mode
- Format with Prettier
- Lint with ESLint
- Use functional components with hooks

```typescript
interface AgentCardProps {
  agent: AgentConfig;
  onEdit: (id: string) => void;
}

export function AgentCard({ agent, onEdit }: AgentCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3>{agent.name}</h3>
      <button onClick={() => onEdit(agent.id)}>Edit</button>
    </div>
  );
}
```

## Writing Plugins

One of the best ways to contribute is by writing new plugins.

### Plugin Structure

```python
# apps/worker/plugins/llm/my_provider.py

from core.interfaces import BaseLLM, LLMConfig, Message
from main import register_plugin

@register_plugin("llm", "my_provider")
class MyProviderLLM(BaseLLM):
    """
    My Provider LLM Plugin

    This plugin integrates My Provider's API for text generation.

    Environment Variables:
        MY_PROVIDER_API_KEY: API key for My Provider

    Example:
        Set LLM_PROVIDER=my_provider in your .env file.
    """

    @property
    def provider_name(self) -> str:
        return "my_provider"

    async def generate(self, messages: list[Message], **kwargs):
        # Implementation here
        pass

    async def generate_with_tools(self, messages, tools, **kwargs):
        # Implementation here
        pass
```

### Plugin Checklist

- [ ] Implements all abstract methods
- [ ] Has proper type hints
- [ ] Includes docstrings
- [ ] Has unit tests
- [ ] Updates .env.example with new variables
- [ ] Updates README with provider info

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(worker): add Anthropic LLM plugin
fix(web): resolve dashboard loading state
docs: update plugin development guide
```

## Testing

### Running Tests

```bash
# All tests
make test

# Web tests
make test-web

# Worker tests
make test-worker

# With coverage
cd apps/worker && uv run pytest --cov
```

### Writing Tests

```python
# apps/worker/tests/test_openai_plugin.py

import pytest
from unittest.mock import AsyncMock, patch

from core.interfaces import LLMConfig, Message, MessageRole
from main import OpenAILLM

@pytest.fixture
def config():
    return LLMConfig(
        provider="openai",
        model="gpt-4o",
        api_key="test-key",
    )

@pytest.mark.asyncio
async def test_generate_returns_text(config):
    llm = OpenAILLM(config)

    with patch.object(llm, '_get_client') as mock_client:
        mock_client.return_value.chat.completions.create = AsyncMock(
            return_value=mock_stream()
        )

        messages = [Message(role=MessageRole.USER, content="Hello")]
        result = [chunk async for chunk in llm.generate(messages)]

        assert len(result) > 0
```

## Documentation

- Update README.md for user-facing changes
- Add inline comments for complex logic
- Update API docs for endpoint changes
- Include examples in docstrings

## Release Process

Releases are managed by maintainers:

1. Version bump in package.json/pyproject.toml
2. Update CHANGELOG.md
3. Create release tag
4. GitHub Actions builds and publishes

## Getting Help

- [GitHub Discussions](https://github.com/your-org/voxnexus/discussions) for questions
- [Discord](https://discord.gg/voxnexus) for real-time chat
- [Issues](https://github.com/your-org/voxnexus/issues) for bugs

## Recognition

Contributors are recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project README

Thank you for contributing to VoxNexus!
