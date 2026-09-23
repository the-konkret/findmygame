import { defineConfig } from 'allure';

// Allure Report settings. `npm run report` builds the report from allure-results/ and opens it.
export default defineConfig({
  name: 'FindMyGame – test report',
  output: './allure-report',
  plugins: {
    awesome: {
      options: {
        reportName: 'FindMyGame – test report',
        reportLanguage: 'en',
        singleFile: false,
      },
    },
  },
});
