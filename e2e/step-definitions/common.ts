import {
	After,
	AfterAll,
	Before,
	BeforeAll,
	setWorldConstructor,
} from "@cucumber/cucumber";
import {
	type Browser,
	type BrowserContext,
	chromium,
	type Page,
} from "@playwright/test";

interface BddContext {
	page: Page;
	context: BrowserContext;
}

export class CustomWorld implements BddContext {
	page!: Page;
	context!: BrowserContext;
}

setWorldConstructor(CustomWorld);

let browser: Browser;

BeforeAll(async () => {
	browser = await chromium.launch({ headless: true });
});

AfterAll(async () => {
	await browser.close();
});

Before(async function (this: CustomWorld) {
	this.context = await browser.newContext({
		storageState: "playwright/.auth/user.json",
	});
	this.page = await this.context.newPage();
	await this.page.goto("/");
	try {
		await this.page.waitForSelector("[data-sidebar]", { timeout: 15000 });
	} catch {
		// Auth may not be set up — tests will fail informatively
	}
});

After(async function (this: CustomWorld) {
	await this.page.close();
	await this.context.close();
});
