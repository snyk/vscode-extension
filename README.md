# DeepCode extension

***VS Code extension provided by <a href="https://www.deepcode.ai/">DeepCode.ai</a> to detect important bugs and issues in your code. Supports Java, Python, JavaScript, TypeScript and XML***

DeepCode's AI algorithms continuously learn from bugs and issues fixed on open source
repos. The extension will automatically alert you about critical vulnerabilities you need to solve
in your code every time you save a file. Don't let security bugs go to production. Save time
finding and fixing them.


# How it works

Select desired environment between Cloud and Self-managed:
![deepcode environment](images/environment.png)

Login Deepcode extension using your Bitbucket.org, Github.com or GitLab.com account:
![deepcode login](images/login.png)

Confirm uploading your code to DeepCode server. Your code is protected and used only for the purpose of informing you about issues in code:
![deepcode consent](images/consent.png)

DeepCode extension analyses your code:
![deepcode progress](images/progress.png)

Inspect all found issues using "Problems" tab and syntax highlight:
![deepcode problem](images/problem.png)

Ignore certain files/folders, by adding a file .dcignore to any folder. The file syntax is identical to .gitignore:
![deepcode dcignore](images/ignore_file.png)

Ignore particular alert directly within its suggestions tooltip or 'bulb' menu:
![deepcode ignore menu](images/ignore_menu.png)

Deepcode will create a comment, that will inform analysis engine to ignore it. Don't forget to specify a description why you think it needs to be ignored. Your feedback will improve our engine over time:
![deepcode ignore comment](images/ignore_comment.png)
