# Transoon - AI Translation Tool

Transoon is a modern translation application built to support translating documents such as Word, PDF, Excel, PowerPoint, and other text formats. The application is designed to preserve formatting, ensure consistency, and support reuse of previously translated phrases.

## Key Features

- **Multi-format translation**: Supports translating Word (DOCX), PDF, Excel (XLSX), PowerPoint (PPTX), and plain text documents.
- **Format preservation**: Maintains the original structure and formatting (bold, italic, tables, etc.) of the source document.
- **Translation memory**: Reuses previously translated phrases to ensure consistency and reduce costs.
- **Chunk-based translation**: Processes text in chunks to avoid memory overflow.
- **Modern UI**: User interface built with React and Material-UI.
- **Multiple translation providers**: Integration with AI translation services like Google Translate, DeepSeek, Qwen, etc.

## System Architecture

Transoon is built using a client-server architecture:

### Client (Frontend)

- **Technology**: React 19, TypeScript, Vite, Material-UI
- **Features**: User interface, file processing, document preview display
- **Libraries**: ag-Grid for tables, Socket.IO for real-time communication

### Server (Backend)

- **Technology**: Node.js, Express, TypeScript
- **Features**: Translation, file processing, project management, translation memory
- **Libraries**: ExcelJS, Mammoth, jszip, multer

## Installation

### System Requirements

- Node.js (version 18 or higher)
- npm or yarn

### Installing Dependencies

```bash
# Install dependencies for both client and server
cd client && npm install
cd ../server && npm install
```

## Running the Application

### Development Server

```bash
# Run backend server
cd server
npm run dev

# In another terminal, run frontend client
cd client
npm run dev
```

The application will run at:

- Client: http://localhost:5173
- Server: http://localhost:3000

### Production Build

```bash
# Build client
cd client
npm run build

# Build server
cd server
npm run build

# Run production server
npm start
```

## Usage

1. **Create a new project**: Create a project to manage documents to be translated.
2. **Upload documents**: Upload Word, PDF, Excel, PowerPoint, or text documents.
3. **Preview documents**: View document preview to check structure.
4. **Translate documents**: Select translation provider and start the translation process.
5. **Download results**: Download translated documents with preserved original formatting.

## Configuration

### Application Settings

The application supports configuration through settings:

- **Default translation provider**: Select the default translation service.
- **Default languages**: Set default source and target languages.
- **Translation options**: Configure translation options.

### Translation Memory

- **Create translation memory**: Create translation memories to store translated phrases.
- **Manage memory**: Add, edit, delete translation units.
- **Integrate into projects**: Attach translation memories to projects for use during translation.

## API

### Translation API

- **POST /translate**: Translate a document.
  ```json
  {
    "file": <binary>,
    "sourceLang": "ja",
    "targetLang": "en"
  }
  ```

### Project Management API

- **GET /projects**: Get list of projects.
- **POST /projects**: Create a new project.
- **PUT /projects/:id**: Update a project.
- **DELETE /projects/:id**: Delete a project.

### Translation Memory API

- **GET /translation-memories**: Get list of translation memories.
- **POST /translation-memories**: Create a new translation memory.
- **PUT /translation-memories/:id**: Update a translation memory.
- **DELETE /translation-memories/:id**: Delete a translation memory.

## Development

### Directory Structure

```
transoon/
├── client/           # Frontend (React)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Pages
│   │   ├── styles/         # CSS/SCSS
│   │   └── app/            # Application configuration
│   └── public/             # Static resources
├── server/           # Backend (Node.js)
│   ├── src/
│   │   ├── documents/      # Document processing
│   │   ├── providers/      # Translation providers
│   │   ├── translation/    # Translation
│   │   ├── translation-memory/  # Translation memory
│   │   └── migrations/     # Database migrations
│   └── public/             # Static resources
└── README.md
```

### Adding a New Translation Provider

1. Create a new class in `server/src/providers/` that extends `TranslateProvider`.
2. Implement required methods: `translate()`, `getName()`, `getSupportedLanguages()`.
3. Register the provider in `server/src/translate-provider.ts`.

### Adding a New Document Format

1. Create a new handler in `server/src/documents/handlers/`.
2. Implement methods: `parse()`, `segment()`, `render()`.
3. Register the handler in `server/src/documents/document-registry.ts`.

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- **Author**: Giatkt1598
- **Email**: giatkt1598@gmail.com
- **Repository**: https://github.com/giatkt1598/transoon

---

## Quick Start

### Quick Start

```bash
# Clone repository
git clone https://github.com/giatkt1598/transoon.git
cd transoon

# Install dependencies
cd client && npm install && cd ..
cd server && npm install && cd ..

# Run application
npm run dev
```

### Useful npm Commands

- `npm run dev`: Run both client and server in development mode.
- `npm run build`: Build both client and server for production.
- `npm run lint`: Run linting checks.

---

**Transoon** - AI Translation, fast and accurate!
