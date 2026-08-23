import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("notes router (US1)", () => {
  it("POST /notes creates a note and returns 201 with the note body", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/notes")
      .send({ title: "Groceries", content: "Milk, eggs, bread" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: "Groceries", content: "Milk, eggs, bread" });
    expect(res.body.id).toBeTruthy();
    expect(res.body.updatedAt).toBeTruthy();
  });

  it("POST /notes returns 400 when title or content is empty", async () => {
    const app = createApp();

    const res = await request(app).post("/notes").send({ title: "", content: "x" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("GET /notes lists all created notes", async () => {
    const app = createApp();
    await request(app).post("/notes").send({ title: "A", content: "a" });
    await request(app).post("/notes").send({ title: "B", content: "b" });

    const res = await request(app).get("/notes");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("GET /notes/:id returns the matching note", async () => {
    const app = createApp();
    const created = await request(app).post("/notes").send({ title: "A", content: "a" });

    const res = await request(app).get(`/notes/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "A", content: "a" });
  });

  it("GET /notes/:id returns 404 for an unknown id", async () => {
    const app = createApp();

    const res = await request(app).get("/notes/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});

describe("notes router (US2)", () => {
  it("PATCH /notes/:id updates the note and returns 200 with refreshed updatedAt", async () => {
    const app = createApp();
    const created = await request(app).post("/notes").send({ title: "A", content: "a" });

    const res = await request(app)
      .patch(`/notes/${created.body.id}`)
      .send({ content: "updated" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "A", content: "updated" });
    expect(res.body.updatedAt).not.toBe(created.body.updatedAt);
  });

  it("PATCH /notes/:id accepts a same-value update and still refreshes updatedAt", async () => {
    const app = createApp();
    const created = await request(app).post("/notes").send({ title: "A", content: "a" });

    const res = await request(app)
      .patch(`/notes/${created.body.id}`)
      .send({ title: "A", content: "a" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "A", content: "a" });
  });

  it("PATCH /notes/:id returns 400 when a supplied field is empty", async () => {
    const app = createApp();
    const created = await request(app).post("/notes").send({ title: "A", content: "a" });

    const res = await request(app).patch(`/notes/${created.body.id}`).send({ title: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("PATCH /notes/:id returns 400 when neither field is present (FR-010)", async () => {
    const app = createApp();
    const created = await request(app).post("/notes").send({ title: "A", content: "a" });

    const res = await request(app).patch(`/notes/${created.body.id}`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("PATCH /notes/:id returns 404 for an unknown id", async () => {
    const app = createApp();

    const res = await request(app).patch("/notes/does-not-exist").send({ title: "x" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});

describe("notes router (US3)", () => {
  it("DELETE /notes/:id removes the note and returns 204 with no body", async () => {
    const app = createApp();
    const created = await request(app).post("/notes").send({ title: "A", content: "a" });

    const res = await request(app).delete(`/notes/${created.body.id}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const followUp = await request(app).get(`/notes/${created.body.id}`);
    expect(followUp.status).toBe(404);
  });

  it("DELETE /notes/:id returns 404 for an unknown id", async () => {
    const app = createApp();

    const res = await request(app).delete("/notes/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});
