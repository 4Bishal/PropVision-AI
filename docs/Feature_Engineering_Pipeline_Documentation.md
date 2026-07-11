# Feature Engineering Pipeline Documentation

## Objective

Transform raw, unstructured real estate data into structured, high-value
predictive features that improve predictive performance, model
interpretability, and data consistency.

------------------------------------------------------------------------

# 1. Area Dimensions Extraction (`area_with_type`)

## Objective

Extract standardized numerical area measurements from unstructured
textual descriptions.

### Input

Raw `area_with_type` strings containing mixed measurements such as Super
Built-up Area, Carpet Area, and Built-up Area.

### Methodology

-   Applied Regular Expressions (Regex) together with Named Entity
    Recognition (NER)-inspired parsing techniques to identify area
    measurements.
-   Parsed and separated different area types into individual numerical
    attributes.

### Generated Features

-   `super_built_up_area`
-   `carpet_area`
-   `built_up_area`

### Data Refinement

-   Normalized inconsistent units and formatting.
-   Applied binning/segmentation where appropriate.
-   Handled missing values independently for each extracted area
    feature.

### Outcome

Converted a single noisy text field into multiple structured numerical
variables suitable for machine learning models.

------------------------------------------------------------------------

# 2. Additional Room Feature Engineering (`additional_room`)

## Objective

Quantify the availability of additional rooms within each property.

### Input

Categorical/textual descriptions listing available room types.

### Methodology

-   Identified the complete set of room categories.
-   Parsed each property's room list.
-   Created separate numerical indicators representing the count (or
    presence) of each room type.

### Example Features

-   `count_bedrooms`
-   `count_bathrooms`
-   `count_kitchens`
-   `count_balconies`
-   Additional room-specific count columns where applicable.

### Outcome

Converted categorical room descriptions into structured numerical
features that better represent property layout and spatial capacity.

------------------------------------------------------------------------

# 3. Furnished Status Classification (`furnished_detail`)

## Objective

Transform unstructured furniture descriptions into standardized
furnishing categories.

### Input

Text describing furniture and appliances included with the property.

### Methodology

#### Step 1 --- Furniture Extraction

-   Parsed furniture descriptions.
-   Counted the number of furniture items available in each property.

#### Step 2 --- Unsupervised Clustering

-   Constructed a temporary dataset using furniture counts.
-   Applied K-Means clustering to group similar furnishing levels.

#### Step 3 --- Category Mapping

Mapped resulting clusters into industry-standard categories:

  Cluster   Furnishing Category
  --------- ---------------------
  0         Unfurnished
  1         Semi-Furnished
  2         Fully Furnished

### Generated Feature

-   `furnished_category`

### Outcome

Replaced inconsistent free-text descriptions with a standardized
categorical feature suitable for downstream modeling.

------------------------------------------------------------------------

# 4. Luxury Score Generation (`features`)

## Objective

Create a numerical representation of the overall luxury level of each
property.

### Challenge

Initial experimentation using K-Means clustering and the Elbow Method
did not reveal meaningful cluster separation, making clustering
unsuitable for luxury estimation.

### Proposed Solution

An LLM-assisted feature scoring approach was adopted.

### Methodology

#### Step 1 --- Feature Inventory

Extracted all unique amenities and property features from the dataset.

#### Step 2 --- Expert Evaluation

Prompted a Large Language Model (LLM) to act as an experienced real
estate broker.

#### Step 3 --- Feature Rating

Assigned each unique amenity a score between **0 and 10** based on
perceived market value and luxury contribution.

#### Step 4 --- Property-Level Aggregation

For each property:

**Luxury Score = Σ (Feature Weight)**

where Feature Weight represents the LLM-assigned score for every
available amenity.

### Generated Feature

-   `luxury_score`

### Outcome

Produced a continuous numerical variable that captures the overall
quality and premium nature of a property's amenities.

------------------------------------------------------------------------

# Summary

  Feature Engineering Task    Output
  --------------------------- -------------------------------------
  Area Extraction             Structured numerical area variables
  Additional Rooms            Room count features
  Furnishing Classification   Standard furnishing category
  Luxury Scoring              Continuous luxury score

## Overall Impact

The feature engineering pipeline significantly enhanced the dataset by
converting multiple unstructured attributes into meaningful numerical
and categorical features. These engineered variables provide richer
property representations, improve predictive capability, and enable more
robust machine learning models for real estate price prediction.
