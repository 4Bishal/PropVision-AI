# 🏠 PropVision AI

**An end-to-end AI-powered real estate intelligence platform that transforms raw property listing data into predictive insights and personalized recommendations.**

[![Python](https://img.shields.io/badge/Python-3.x-blue.svg)](https://www.python.org/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-ML-orange.svg)](https://scikit-learn.org/)
[![XGBoost](https://img.shields.io/badge/XGBoost-Regression-brightgreen.svg)](https://xgboost.readthedocs.io/)
[![Status](https://img.shields.io/badge/status-in--development-yellow.svg)]()

---

## 📌 Overview

PropVision AI is a real estate analytics and prediction platform built on a self-scraped dataset from **99acres**. It takes raw, semi-structured property listings and turns them into structured, high-value features that power a **house price prediction model** and a **content-based property recommendation engine**.

The project follows a complete data science lifecycle — from data collection and cleaning through EDA, feature engineering, model optimization, and (eventually) a full-stack application layer.

```
Data Collection → Data Cleaning → EDA → Feature Engineering →
ML Modeling → Evaluation → Recommendation System → Deployment
```

---

## ✨ Key Features

- **Automated data cleaning** of noisy, semi-structured real estate listings (e.g. converting `₹1.5 Cr` → `15000000`)
- **Regex-based feature extraction** to parse mixed area fields into distinct, structured columns
- **Price prediction** using tree-based ensemble models, including a deep dive into XGBoost internals
- **Content-based recommendation engine** for suggesting properties based on user preferences
- Designed with a clear path toward a full **MERN-stack** application layer

---

## 🗂️ Table of Contents

- [Data Collection](#-data-collection)
- [Data Preprocessing](#-data-preprocessing)
- [Exploratory Data Analysis](#-exploratory-data-analysis-eda)
- [Feature Engineering](#-feature-engineering)
- [Machine Learning](#-machine-learning)
- [Model Evaluation](#-model-evaluation)
- [Recommendation System](#-recommendation-system)
- [Tech Stack](#-tech-stack)
- [Project Philosophy](#-project-philosophy)
- [Roadmap](#-roadmap)

---

## 📊 Data Collection

Property listing data was **self-scraped** from [99acres](https://www.99acres.com/), including attributes such as:

- Location, price, area, area type
- Bedrooms, bathrooms, property type
- Furnishing status, amenities
- Builder information, possession details

The raw data was semi-structured and required significant cleaning before it could be used for modeling.

---

## 🧹 Data Preprocessing

**1. Missing Value Handling**
- Identification of missing values across columns
- Removal of unnecessary/irrelevant columns
- Imputation of missing numerical and categorical values
- Handling of inconsistent entries

**2. Data Cleaning**
- Removing duplicate records
- Standardizing text formats
- Converting numerical values stored as strings into usable numeric types
- Stripping irrelevant characters

**Example transformation:**

| Raw Value | Cleaned Value |
|---|---|
| `₹1.5 Cr` | `15000000` |

---

## 🔎 Exploratory Data Analysis (EDA)

EDA was conducted to surface patterns and inform feature engineering:

- **Price Distribution** — average price, variance, outlier detection, most expensive locations
- **Location Analysis** — regional price patterns and property availability by location
- **Feature Relationships** — Area vs. Price, Bedrooms vs. Price, Location vs. Price, Property Type vs. Price

**Visualization techniques used:** histograms, scatter plots, box plots, bar charts, correlation heatmaps.

---

## 🛠️ Feature Engineering

### Area Dimensions Extraction

Raw listings often embedded area information inside free-text fields, e.g.:

```
1200 sqft Super Built-up Area
900 sqft Carpet Area
```

Using **regular expressions** and text processing, this information was parsed into clean, structured numerical features:

- `Super_Built_Up_Area`
- `Carpet_Area`
- `Built_Up_Area`

### Area Feature Refinement
- Conversion to numerical format
- Handling of missing area types
- Removing inconsistencies
- Feature normalization

---

## 🤖 Machine Learning

### Problem Formulation

| Attribute | Value |
|---|---|
| **Task** | Supervised Learning |
| **Problem Type** | Regression |
| **Target Variable** | Property Price |

### Pipeline

```
Raw Dataset → Feature Selection → Train-Test Split → Model Training →
Hyperparameter Optimization → Evaluation → Final Model Selection
```

### Models Explored

**Linear Models (baseline)**
- Linear Regression
- Ridge Regression
- Lasso Regression

**Tree-Based Models** (to capture nonlinear relationships in real estate data)
- Decision Tree Regression
- Random Forest Regression
- Gradient Boosting
- XGBoost Regression

### Understanding XGBoost

The project involved an in-depth study of gradient boosting and XGBoost internals:

- Sequential tree building and residual error correction
- Weak learners combined via ensemble learning
- Objective function, loss function, gradient and Hessian approximation
- Tree construction and regularization

**Prediction formula:**

$$\hat{y}_i = \sum_{k=1}^{K} f_k(x_i)$$

where `K` is the number of trees and `f_k` is an individual decision tree.

**Objective function:**

$$Obj(\theta) = Loss + \Omega(Model)$$

- **Loss** measures prediction error
- **Ω (Regularization)** controls model complexity to reduce overfitting

### Hyperparameter Tuning

| Parameter | Purpose |
|---|---|
| `n_estimators` | Number of boosting rounds |
| `learning_rate` | Contribution of each tree |
| `max_depth` | Tree complexity control |
| `lambda`, `alpha`, `gamma` | Regularization to reduce overfitting |
| `subsample`, `colsample_bytree` | Row/feature sampling for better generalization |

---

## 📈 Model Evaluation

Regression performance is assessed using:

- **Mean Squared Error (MSE)** — average squared prediction error
- **Root Mean Squared Error (RMSE)** — error in original price units
- **R² Score** — proportion of variance explained by the model

**Example result:**

```
R² = 0.83
RMSE = 0.21
```

> The model explains approximately 83% of the variance in property prices in the dataset.

---

## 🎯 Recommendation System

A **content-based recommendation engine** is planned/developed to suggest properties based on:

- Location
- Budget
- Property characteristics (area, bedrooms, amenities)

### Envisioned User Flow

```
User enters preferences
        ↓
System analyzes requirements
        ↓
ML model predicts prices
        ↓
Recommendation engine finds suitable properties
        ↓
User receives intelligent property suggestions
```

---

## 🧰 Tech Stack

**Data Science**
- Python, Pandas, NumPy, Matplotlib, Seaborn

**Machine Learning**
- Scikit-learn, XGBoost

**Data Collection**
- Custom web scraping

**Future Application Layer**
- **Frontend:** React.js
- **Backend:** Node.js, Express.js
- **Database:** MongoDB

---

## 💡 Project Philosophy

PropVision AI is built around an engineering-first mindset rather than a "train a model, report accuracy" approach:

```
Real-world Data → Data Understanding → Feature Engineering →
Model Selection → Optimization → Deployment → User Application
```

The goal is to build a complete, production-minded AI product — not just a notebook experiment.

---

## 🗺️ Roadmap

- [x] Web scraping pipeline for 99acres listings
- [x] Data cleaning & preprocessing
- [x] Exploratory Data Analysis
- [x] Feature engineering (area extraction, normalization)
- [x] Baseline and tree-based regression models
- [x] XGBoost model tuning & evaluation
- [ ] Content-based recommendation engine (in progress)
- [ ] REST API backend (Node.js/Express)
- [ ] React.js frontend application
- [ ] Full MERN-stack deployment

---

## 📄 License

*This project is licensed under the MIT License - see the [LICENSE](LICENSE.txt) file for details.*

## 🙋 Author

*Bishal Bhandari / bhandari-bishal.com.np*
