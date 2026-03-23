const AppConfig = {
  version: '0.3.0',
  appName: '嵌入式开发工具箱',
  author: 'Ryan Chen',
  repo: {
    owner: 'NotFoundRyan',
    name: 'EmbeddedTools'
  }
};

function getAppVersion() {
  return AppConfig.version;
}

function getAppName() {
  return AppConfig.appName;
}

function getFullVersion() {
  return 'v' + AppConfig.version;
}

function getRepoInfo() {
  return AppConfig.repo;
}
