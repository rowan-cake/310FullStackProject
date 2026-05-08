# Frontend Insights

This frontend adds three simple visual insights to the existing InsightUBC page. The charts are shown directly on page load and use data from the backend API. If the backend starts empty, demo data is seeded automatically so the TAs do not need to upload anything manually to see the visualizations.

## 1. Average Grade by Department

**What it shows:**  
A bar chart showing the average course grade for each department currently returned by the backend.

**Why this matters / use case:**  
This helps compare student outcomes across departments in a quick visual way.

**Why would a decision-maker at UBC care?**  
A department head or academic planner could use this to spot departments with unusually low or high average grades and decide whether they want to look more closely at course difficulty, grading patterns, or student support needs.

---

## 2. Room Types by Count

**What it shows:**  
A bar chart showing how many rooms belong to each room type. The chart can also be filtered by building.

**Why this matters / use case:**  
This helps summarize the kinds of teaching spaces that exist in the facilities dataset.

**Why would a decision-maker at UBC care?**  
A facilities planner or scheduling staff member could use this to understand whether UBC has more small-group rooms, lecture spaces, labs, or other types of rooms, which is useful when planning space usage.

---

## 3. Building Capacity vs Room Count

**What it shows:**  
A scatter plot comparing buildings by number of rooms and largest room size. Bubble size represents total seats in the building.

**Why this matters / use case:**  
This gives a quick way to compare buildings by both size and teaching capacity instead of only looking at one number.

**Why would a decision-maker at UBC care?**  
A facilities or timetabling decision-maker could use this to identify buildings with many small rooms, buildings with very large teaching spaces, or buildings with especially high total capacity when thinking about room allocation and future planning.

---

## Backend Integration

All three insights use backend data as their source:
- course insight data comes from the backend search API
- facilities insight data comes from the backend search and building APIs

The frontend does not rely on manually entered chart data.

## Interactivity

The insights include basic interaction:
- hovering over chart elements shows more detail
- the course filters affect the department average chart
- the building dropdown affects the room type chart
- the slider changes how many buildings are shown in the capacity plot