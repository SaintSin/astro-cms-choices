// Makes every `th.sortable` keyboard-operable: wraps the label in a button
// (Enter/Space click it, which bubbles to the page's existing th click
// handler), mirrors the page's sort-asc/sort-desc classes into aria-sort, and
// announces each sort once via a role="status" element.
const headers = document.querySelectorAll<HTMLTableCellElement>("th.sortable");

if (headers.length) {
	const status = document.createElement("div");
	status.className = "sort-status";
	status.setAttribute("role", "status");
	document.body.append(status);

	for (const th of headers) {
		th.scope = "col";
		const button = document.createElement("button");
		button.type = "button";
		button.append(...th.childNodes);
		th.append(button);

		new MutationObserver(() => {
			const dir = th.classList.contains("sort-asc")
				? "ascending"
				: th.classList.contains("sort-desc")
					? "descending"
					: null;
			if (dir) {
				th.setAttribute("aria-sort", dir);
				status.textContent = `Sorted by ${button.textContent?.trim()}, ${dir}`;
			} else th.removeAttribute("aria-sort");
		}).observe(th, { attributes: true, attributeFilter: ["class"] });
	}
}
