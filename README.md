# tropical-GEE
Scripts of Google Earth Engine for the project TROPICAL-PREDICT.

Originally forked from [smartfood-GEE](https://github.com/KhaosResearch/smartfood-GEE), the script [getIndices](https://github.com/KhaosResearch/tropical-GEE/blob/main/getIndices.js) takes a shapefile and asks the user for a specific date range and cloud percentage threshold. Then, after selecting the desired indices, the script generates a map with the TCI for the shapefiles, an interactive chart with the timeseries data and prints in the console the URL for downloading the data in CSV format. Note that both the represented and downloadable data are the mean for all the pixel values, for each date.

## TODO
- Improve the date selection to avoid choosing the current date
- Modify the CSV columns to make the output clearer
- Remove temporary code for mocking purposes once the input shapefile format is clear
