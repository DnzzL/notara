import { h1, p, type TemplateDef } from "./_kit.js";

export default {
	id: "trip-planner",
	title: "Trip Planner",
	icon: "✈️",
	description: "Itinerary, bookings with budget, and a guest list.",
	blocks: [
		h1("Trip Planner ✈️"),
		p(
			"One place for a trip or event: the <strong>Guests</strong> list, the day-by-day <strong>Itinerary</strong> (linked to guests), and <strong>Bookings</strong> with their cost.",
		),
		{
			kind: "database",
			name: "Guests",
			titleLabel: "Name",
			fields: [
				{
					name: "RSVP",
					type: "select",
					options: ["Invited", "Confirmed", "Declined"],
				},
				{ name: "Notes", type: "text" },
			],
			views: [
				{ name: "Guest list", type: "table" },
				{ name: "By RSVP", type: "board", groupByFieldName: "RSVP" },
			],
			records: [
				{
					title: "Léa",
					values: { RSVP: "Confirmed", Notes: "Vegetarian" },
				},
				{ title: "Noah", values: { RSVP: "Confirmed" } },
				{
					title: "Sofia",
					values: { RSVP: "Invited", Notes: "Arrives a day late" },
				},
				{ title: "Hugo", values: { RSVP: "Declined" } },
			],
		},
		{
			kind: "database",
			name: "Itinerary",
			titleLabel: "Activity",
			fields: [
				{ name: "Date", type: "date" },
				{
					name: "Type",
					type: "select",
					options: ["Travel", "Sightseeing", "Food", "Free time"],
				},
				{ name: "Who", type: "relation", relationTargetName: "Guests" },
			],
			views: [{ name: "Day by day", type: "table" }],
			records: [
				{
					title: "Train Paris → Lisbon",
					values: { Date: "2027-05-03", Type: "Travel" },
					relations: { Who: ["Léa", "Noah", "Sofia"] },
				},
				{
					title: "Walking tour of Alfama",
					values: { Date: "2027-05-04", Type: "Sightseeing" },
					relations: { Who: ["Léa", "Noah"] },
				},
				{
					title: "Dinner at Time Out Market",
					values: { Date: "2027-05-04", Type: "Food" },
					relations: { Who: ["Léa", "Noah", "Sofia"] },
				},
				{
					title: "Day trip to Sintra",
					values: { Date: "2027-05-05", Type: "Sightseeing" },
					relations: { Who: ["Léa", "Sofia"] },
				},
			],
		},
		{
			kind: "database",
			name: "Bookings",
			titleLabel: "Booking",
			fields: [
				{
					name: "Status",
					type: "select",
					options: ["To book", "Booked", "Paid"],
				},
				{
					name: "Category",
					type: "select",
					options: ["Transport", "Lodging", "Activities", "Food"],
				},
				{ name: "Cost (€)", type: "number" },
				{ name: "Confirmation", type: "text" },
			],
			views: [
				{ name: "Budget", type: "table" },
				{ name: "By status", type: "board", groupByFieldName: "Status" },
			],
			records: [
				{
					title: "Train tickets (3 people)",
					values: {
						Status: "Paid",
						Category: "Transport",
						"Cost (€)": "312",
						Confirmation: "TRN-48213",
					},
				},
				{
					title: "Apartment in Alfama, 3 nights",
					values: {
						Status: "Booked",
						Category: "Lodging",
						"Cost (€)": "540",
						Confirmation: "BKG-77120",
					},
				},
				{
					title: "Sintra palace tickets",
					values: {
						Status: "To book",
						Category: "Activities",
						"Cost (€)": "60",
					},
				},
				{
					title: "Group dinner reservation",
					values: { Status: "To book", Category: "Food", "Cost (€)": "150" },
				},
			],
		},
	],
} satisfies TemplateDef;
