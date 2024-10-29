# Data Analysis for Copilot

Data Analysis for Copilot empowers people in data science field. From cleaning up user's .csv file to performing higher level of data analysis by leveraging different statistics measures, graphs, and predictive models, the @data agent helps user make more advanced and informed decisions by offering tailored insights and interactivity for data tasks. The extension contributes a tool where the LLM can ask it to execute Python code via using [Pyodide](https://pyodide.org/en/stable/) and get the result of the relevant Python code execution. It is also able to smartly re-try for better or more appropriate execution results in case of error or failure. You can also export the code used to perform the analysis (or generate visualizations) into a Jupyter Notebook or a Python file.

#### Data analysis and visualizations

* Given a csv file enter the prompt such as `Analyze the file #<file name>` or write a more specific prompt (see below recording).
* Provide follow up prompts requesting the generation of visualizations (charts, plots or the like).

![Data Analysis of CSV file with visualizations]()

#### Exporting the code used to perform the data analysis and generate the visualizations

* Python code used to perform the analysis and generate visualizations can be viewed.
* Code can be exported in Jupyter Notebooks or a plain Python file

![Exporting the code used to perform the analysis]()

#### Editor and explorer integrations for *.csv files

* Right click on a csv file to analyze it.
* Open a csv file and use the icon to analyze the file.

![Editor and explorer integration to analyze csv files]()


## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft
trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
