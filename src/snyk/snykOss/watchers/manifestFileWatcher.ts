import * as vscode from 'vscode';
import { IExtension } from '../../base/modules/interfaces';
import { IConfiguration } from '../../common/configuration/configuration';
import { IVSCodeWorkspace } from '../../common/vscode/workspace';

// to be kept in sync with Snyk CLI support list
// copied from https://github.com/snyk/snyk/blob/93ec5896282e3ba1389dc5604589d2773a4bf517/src/lib/package-managers.ts#L21
enum SUPPORTED_MANIFEST_FILES {
  GEMFILE = 'Gemfile',
  GEMFILE_LOCK = 'Gemfile.lock',
  GEMSPEC = '*.gemspec',
  PACKAGE_LOCK_JSON = 'package-lock.json',
  POM_XML = 'pom.xml',
  JAR = '*.jar',
  WAR = '*.war',
  BUILD_GRADLE = 'build.gradle',
  BUILD_GRADLE_KTS = 'build.gradle.kts',
  BUILD_SBT = 'build.sbt',
  YARN_LOCK = 'yarn.lock',
  PACKAGE_JSON = 'package.json',
  PIPFILE = 'Pipfile',
  SETUP_PY = 'setup.py',
  REQUIREMENTS_TXT = 'requirements.txt',
  GOPKG_LOCK = 'Gopkg.lock',
  GO_MOD = 'go.mod',
  VENDOR_JSON = 'vendor.json',
  PROJECT_ASSETS_JSON = 'project.assets.json',
  PACKAGES_CONFIG = 'packages.config',
  PROJECT_JSON = 'project.json',
  PAKET_DEPENDENCIES = 'paket.dependencies',
  COMPOSER_LOCK = 'composer.lock',
  PODFILE_LOCK = 'Podfile.lock',
  COCOAPODS_PODFILE_YAML = 'CocoaPods.podfile.yaml',
  COCOAPODS_PODFILE = 'CocoaPods.podfile',
  PODFILE = 'Podfile',
  POETRY_LOCK = 'poetry.lock',
  MIX_EXS = 'mix.exs',
}

export default function createManifestFileWatcher(
  extension: IExtension,
  workspace: IVSCodeWorkspace,
  configuration: IConfiguration,
): vscode.FileSystemWatcher {
  const globPattern = `**/{${Object.values(SUPPORTED_MANIFEST_FILES).join(',')}}`;
  const watcher = workspace.createFileSystemWatcher(globPattern);

  watcher.onDidChange(() => runOssScan());
  watcher.onDidDelete(() => runOssScan());
  watcher.onDidCreate(() => runOssScan());

  function runOssScan() {
    if (configuration.shouldAutoScanOss) {
      void extension.runOssScan();
    }
  }

  return watcher;
}
