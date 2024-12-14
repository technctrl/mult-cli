const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const cliProgress = require('cli-progress');
const simpleGit = require('simple-git');
const git = simpleGit();

let chalk;
(async () => {
  chalk = (await import('chalk')).default;
})();

// Utilisation de import() dynamique pour charger inquirer
async function getInquirer() {
  const inquirer = (await import('inquirer')).default;
  return inquirer;
}

// Fonction pour afficher un loader pendant l'installation des dépendances
function installDependencies(packageManager, targetDir) {
  console.log(chalk.cyan(`\nInstallation des dépendances avec ${packageManager}...`));

  return new Promise((resolve, reject) => {
    const progressBar = new cliProgress.SingleBar({
      format: 'Installation des dépendances | {bar} | {percentage}% | {value}/{total}',
      barCompleteChar: '=',
      barIncompleteChar: '-',
      hideCursor: true,
      fps: 20,
      clearOnComplete: true,
      barChar: chalk.green('='),
      fg: 'green',
      bg: 'grey',
    }, cliProgress.Presets.shades_classic);
    progressBar.start(100, 0);

    let progress = 0;
    const incrementStep = 5; // Étapes d'incrémentation simulées

    const installProcess = exec(`${packageManager} install --silent`, { cwd: targetDir });

    let interval = setInterval(() => {
      if (progress < 100) {
        progress = Math.min(progress + incrementStep, 100);
        progressBar.update(progress);
      }
    }, 300); // Met à jour la barre de progression chaque seconde

    installProcess.stdout.on('data', (data) => {
      // Traiter les données si nécessaire (par exemple afficher les logs de l'installation)
      console.log(data.toString());
    });

    installProcess.stderr.on('data', (errorData) => {
      // Affiche les erreurs en temps réel si nécessaire
      console.error(chalk.red(`Erreur dans l'installation : ${errorData}`));
    });

    installProcess.on('close', (code) => {
      clearInterval(interval); // Arrêter la mise à jour de la barre
      progressBar.update(100); // Assurez-vous que la barre atteint 100 %
      progressBar.stop();

      if (code === 0) {
        console.log(chalk.green(`\nDépendances installées avec succès!`));
        resolve();
      } else {
        console.error(chalk.red(`Erreur lors de l'installation des dépendances (code ${code}).`));
        reject(new Error(`Installation failed with code ${code}`));
      }
    });
  });
}


// Fonction pour cloner un dépôt Git
async function cloneGitRepository(repoUrl, targetDir) {
  let loaderInterval;
  let dotCount = 0;

  return new Promise((resolve, reject) => {
    // Afficher un message de chargement
    process.stdout.write(chalk.yellow('\nCreation des repertoires'));

    // Affichage dynamique du loader avec des points
    loaderInterval = setInterval(() => {
      dotCount++;
      process.stdout.write('.'.repeat(dotCount % 4 + 1)); // Ajouter entre 1 et 4 points
    }, 500); // Met à jour tous les 500ms

    // Clonage du dépôt
    git.clone(repoUrl, targetDir)
      .then(() => {
        clearInterval(loaderInterval); // Arrêter l'animation des points
        process.stdout.write('\n'); // Aller à la ligne après la fin du clonage
        resolve();
      })
      .catch((error) => {
        clearInterval(loaderInterval); // Arrêter l'animation des points en cas d'erreur
        process.stdout.write('\n');
        reject(error);
      });
  });
}

function shouldSkip(item) {
  console.log(item);
  return item === '.git' || item === '.github';
}

// Fonction principale pour générer la structure du projet
async function generateProjectStructure(projectName) {
  const inquirer = await getInquirer(); // Charger inquirer dynamiquement

  // Demander à l'utilisateur quel gestionnaire de packages il souhaite utiliser
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'packageManager',
      message: '📦 Choisir le gestionnaire ?',
      choices: ['npm', 'yarn', 'pnpm'],
      default: 'npm',
    },
    {
      type: 'input',
      name: 'projectName',
      message: 'Nom de votre projet ',
      default: projectName,
    },
    {
      type: 'list',
      name: 'database',
      message: '💾 Choisir la base de donnée',
      choices: [
        { name: 'MySQL🐬 ', value: 'mysql' },
        { name: 'MongoDB 🗄 ️', value: 'mongodb' },
      ],
      default: 'mysql',
    },
  ]);

  const targetDir = path.join(process.cwd(), answers.projectName); // Créer le dossier avec le nom fourni par l'utilisateur

  // Créer le dossier cible s'il n'existe pas
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
  }

  // Afficher un message avant de commencer le clonage et la copie
  console.log(chalk.cyan('\n⚡ Nous allons créer votre application en quelques secondes...'));

  try {
    // Définir l'URL du dépôt Git directement dans le code
    const repoUrl = 'https://github.com/technctrl/mult.git';

    // Cloner le dépôt Git
    await cloneGitRepository(repoUrl, targetDir);

    // Copier les fichiers et dossiers, y compris leurs sous-dossiers
    const copyWithLogging = async (src, dest) => {
      const items = await fs.readdir(src);
      for (const item of items) {
        if (shouldSkip(item)) {
          continue;
        }
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stats = fs.statSync(srcPath);
        if (stats.isDirectory()) {
          await fs.mkdir(destPath, { recursive: true });
          await copyWithLogging(srcPath, destPath);
        } else {
          await fs.copy(srcPath, destPath);
        }
      }
    };


    // Mettre à jour le fichier .env avec la base de données choisie
    const envPath = path.join(targetDir, '.env.example');
    const envContent = await fs.readFile(envPath, 'utf8');
    const newEnvContent = envContent.replace(
      /DB_TYPE=.*/,
      `DB_TYPE=${answers.database}` // Remplacer par le type de base de données choisi
    );
    await fs.writeFile(path.join(targetDir, '.env'), newEnvContent);

    console.log(chalk.green('La structure du projet a été générée avec succès!'));

    // Installer les dépendances avec le gestionnaire choisi
    await installDependencies(answers.packageManager, targetDir);

    // Afficher le message final avec les commandes à exécuter
    console.log(chalk.green(`\n🚀 Projet ${answers.projectName} créé avec succès`));
    console.log(chalk.yellow(`\n👉 Commencez avec les commandes suivantes :`));
    console.log(chalk.blackBright(`\n$ cd ${answers.projectName}`));
    console.log(chalk.blackBright(`$ npm run dev`));
    console.log(chalk.blackBright(`\n`));
  } catch (err) {
    console.error(chalk.red('Erreur lors de la génération du projet:'), err);
  }
}

module.exports = { generateProjectStructure };
