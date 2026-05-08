### Heres the thinking for the datamodel


Our data model is a database.json file that contains data is this form, chose to use objects instead of arrays because it should faster lookup times for a given course id(because its like a dictonary O(1) lookup instead of O(n) lookup time ) NOTE there is no "id" field it is a key whose value is whatever it needs to be (course,section)
		    
         ```   "courses": {
					"cpsc210":{
						"title": "Software Construction",
						"dept": "Computer Science",
						"code": "210",
						"sections": {
							"21w201":{
								"instructor": "holmes, reid",
								"year": 2021,
								"avg": 76.4,
								"pass": 167,
								"fail": 3,
								"audit": 1
								}
							}
				"cpsc310":{
						"title": "Introduction to Software Engineering",
						"dept": "Computer Science",
						"code": "310",
						"sections": {}
						}
			} ```

	Note I left links out(making dynamic within the endpoint handler things) of this because I am following the video prof badley put out and hopefully that makes it easier
	not harder.