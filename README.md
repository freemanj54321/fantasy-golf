# Mezzters Invitational Golf League

A web application for managing the Mezzters Invitational golf fantasy league, built with React, TypeScript, Vite, and Firebase.

## Features

- 🏌️ Player rankings and statistics
- 🏆 Tournament management and scoring
- 👥 Team management and draft system
- 📊 Real-time leaderboards
- 🔐 User authentication
- 📱 Responsive design
- 🚀 Automated deployment pipeline
- 📌 Version tracking in UI

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your credentials in `.env.local` (see `.env.example` for required variables)

3. Never commit `.env.local` to git

## Deployment

This project uses GitHub Actions for automated deployment to Firebase Hosting.

### 📚 Deployment Documentation

| Guide | Description |
|-------|-------------|
| **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** | ⭐ **START HERE** - Complete setup checklist |
| **[GITHUB_SECRETS_VISUAL_GUIDE.md](./GITHUB_SECRETS_VISUAL_GUIDE.md)** | Visual step-by-step guide for configuring GitHub Secrets |
| **[SETUP_GITHUB_SECRETS.md](./SETUP_GITHUB_SECRETS.md)** | Detailed reference for all required secrets |
| **[QUICK_DEPLOY.md](./QUICK_DEPLOY.md)** | Quick reference for deploying updates |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Complete deployment documentation |

### Quick Deploy

```bash
# Bump version
npm run version:bump:patch  # or minor/major

# Commit and push
git add package.json
git commit -m "Bump version to v1.0.1"
git push origin main

# Deployment happens automatically! 🚀
```

### Version Tracking

The application displays its version number in the footer of every page:
- **Format**: `v1.0.0`
- **Location**: Bottom right of footer
- **Interaction**: Click to see build timestamp
- **Auto-updates**: Version updates automatically with each deployment

## Project Structure

```
mezztersv2/
├── .github/
│   └── workflows/          # GitHub Actions workflows
│       ├── deploy.yml      # Main deployment workflow
│       └── pr-check.yml    # Pull request checks
├── src/
│   ├── components/         # React components
│   ├── pages/             # Page components
│   ├── services/          # API services
│   ├── hooks/             # Custom React hooks
│   ├── models/            # TypeScript interfaces
│   └── firebase.ts        # Firebase configuration
├── functions/             # Firebase Cloud Functions
├── dist/                  # Build output (generated)
└── firebase.json          # Firebase configuration
```

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Hosting, Functions)
- **API**: RapidAPI (golf data)
- **CI/CD**: GitHub Actions
- **Version Control**: Git, GitHub

## Available Scripts

```bash
npm run dev                    # Start development server
npm run build                  # Build for production
npm run preview                # Preview production build
npm run lint                   # Run ESLint
npm run version:bump:patch     # Bump patch version (1.0.0 → 1.0.1)
npm run version:bump:minor     # Bump minor version (1.0.0 → 1.1.0)
npm run version:bump:major     # Bump major version (1.0.0 → 2.0.0)
```

## Firebase Configuration

The project uses Firebase for:
- **Firestore**: Database for players, teams, and tournament data
- **Authentication**: User login and management
- **Hosting**: Static site hosting
- **Functions**: Server-side operations

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Test locally: `npm run build`
4. Commit: `git commit -m "Add my feature"`
5. Push: `git push origin feature/my-feature`
6. Create a Pull Request
7. PR checks will run automatically
8. After approval, merge to `main` for automatic deployment

## Version Management

This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality (backwards compatible)
- **PATCH** version for bug fixes (backwards compatible)

Current version is displayed in the application footer.

## Troubleshooting

### Build Issues
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### Deployment Issues
- Check GitHub Actions logs in the Actions tab
- Verify all GitHub Secrets are configured
- See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

### Version Not Showing
- Hard refresh your browser (Ctrl+F5 / Cmd+Shift+R)
- Verify deployment completed successfully
- Check version was bumped in package.json

## License

Private - Mezzters Invitational

## Support

For deployment help, see the deployment guides listed above.
For code issues, check the GitHub Issues tab.
