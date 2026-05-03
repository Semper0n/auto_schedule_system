const express = require("express");
const cors = require("cors");

const { resources } = require("./config/resources");
const { errorHandler } = require("./middleware/errorHandler");
const { requireAuth } = require("./middleware/auth");
const { registerAuthRoutes } = require("./routes/auth");
const { registerCatalogRoutes } = require("./routes/catalog");
const { registerCrudRoutes } = require("./routes/crud");
const { registerHealthRoutes } = require("./routes/health");
const { registerScheduleRoutes } = require("./routes/schedule");
const { registerTimeSlotTemplateRoutes } = require("./routes/timeSlotTemplates");
const { ensureOwnershipSchema } = require("./services/schema");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

registerHealthRoutes(app);
registerAuthRoutes(app);

app.use("/api", requireAuth);

Object.entries(resources).forEach(([name, config]) => registerCrudRoutes(app, name, config));
registerTimeSlotTemplateRoutes(app);
registerCatalogRoutes(app);
registerScheduleRoutes(app);

app.use(errorHandler);

ensureOwnershipSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend started on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database ownership schema", error);
    process.exit(1);
  });
