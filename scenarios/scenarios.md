## Test long conversations with housing data

Send the following requests, LLM should be able to remember the context and respond to the requests accordingly.

```
@ada help me analyze housing.csv
@ada visualize the data
@ada try to find the correlation between housing value and location
```

## Retry if execution fails

```
// https://www.kaggle.com/datasets/dreb87/jamesbond
// Change the column names and retry a few times (i.e. ensure LLM isn't guessing the column names)
@ada display a histogram of movies per bond actor from jamesbond.csv file
```


## Analyzing housing data (or any other dataset you want to test)

Try with #file and also with mentioning your_dataset.csv like the very first example:

```
@ada help me analyze housing.csv
```

```
@ada analyze data or dataframe
```

```
@ada perform inferential statistics
```

```
@ada perform further advanced data analysis
```

```
@ada maybe correlation analysis
```


TODO:
```
Create visualization after runing relevant Python code
```
