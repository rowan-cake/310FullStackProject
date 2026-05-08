// "DEL /api/v1/orgs/{org}/courses/{course}/sections/{section}"
	app.delete("/api/v1/orgs/:org/courses/:course/sections/:section", async (_req, res) => {
		const orgId = _req.params.org;
		const courseId = _req.params.course;
		const sectionId = _req.params.section;
		const database = await readDB(datadir); //read data base
		const org = database.orgs[orgId];
		if (!org) {
			// if the org doesnt exsit
			const four_O_four = orgToResponse404(orgId);
			res.status(404).json(four_O_four);
			return;
		}
		const course = database.orgs[orgId].courses[courseId];
		if (!course) {
			// if the course doesnt exsits
			const four_O_four = courseToResponse404(courseId);
			res.status(404).json(four_O_four);
			return;
		}
		const section = database.orgs[orgId].courses[courseId].sections[sectionId];
		if (!section) {
			const four_O_four = sectionToResponse404(sectionId);
			res.status(404).json(four_O_four);
			return;
		}
		// if it does exsits format properly then delete it and return 200
		const courseObject = sectionToResponseDEL(sectionId, database.orgs[orgId].courses[courseId].sections[sectionId]);
		delete database.orgs[orgId].courses[courseId].sections[sectionId]; // aprartneyl there is this special keyword thanks chatgpt
		await writeDB(datadir, database);
		res.status(200).json(courseObject);
		return;
	});

	return app;
}