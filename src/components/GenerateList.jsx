import React from "react";
import {
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  Stack,
  Box,
} from "@mui/material";

// Small helpers
const asArray = (v) => (Array.isArray(v) ? v : []);
const byText = (a, b) => String(a?.text ?? "").localeCompare(String(b?.text ?? ""), undefined, { sensitivity: "base" });

export default function GenerateList() {
  // List type: Internship/Mentorship
  const [listType, setListType] = React.useState("internship");

  // Internship filters (course/session)
  const [courseOptions, setCourseOptions] = React.useState([]);
  const [courseLoading, setCourseLoading] = React.useState(false);
  const [courseError, setCourseError] = React.useState("");
  const [selectedCourse, setSelectedCourse] = React.useState("");

  // Internship session options (from 3 attempt fields)
  const [internshipSessionOptions, setInternshipSessionOptions] = React.useState([]);
  const [internshipSessionLoading, setInternshipSessionLoading] = React.useState(false);
  const [internshipSessionError, setInternshipSessionError] = React.useState("");
  const [selectedInternshipSession, setSelectedInternshipSession] = React.useState("");
  
  // Mentorship session options (from 3 attempt fields)
  const [mentorshipSessionOptions, setMentorshipSessionOptions] = React.useState([]);
  const [mentorshipSessionLoading, setMentorshipSessionLoading] = React.useState(false);
  const [mentorshipSessionError, setMentorshipSessionError] = React.useState("");
  const [selectedMentorshipSession, setSelectedMentorshipSession] = React.useState("");


  // Preview data
  const [students, setStudents] = React.useState([]); // array of { STUDENT_NAME, MATRIC_NO, IC_NO, PHONE_NO, EMAIL }
  const [docLoading, setDocLoading] = React.useState(false);
  const [docError, setDocError] = React.useState("");

  const isInternship = listType === "internship";
  // Condition to display print button for generated list (into pdf)
  const hasPreview = students.length > 0;

 // Load course options only for internship flow
  React.useEffect(() => {
    let abort = false;
    if (!isInternship) return;

    (async () => {
      setCourseLoading(true);
      setCourseError("");
      try {
        const res = await fetch("http://localhost:5001/api/course-structure/options");
        if (!res.ok) throw new Error(`Failed to load courses: ${res.status}`);
        const json = await res.json();
        if (abort) return;
        const opts = asArray(json)
          .map((c) => ({
            value: String(c.code),
            text: `${c.code} - ${c.module} (${c.status})`,
          }))
          .sort(byText);
        setCourseOptions(opts);
      } catch (e) {
        if (!abort) setCourseError(e.message || "Failed to load courses");
      } finally {
        if (!abort) setCourseLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [isInternship]);

  // Load session options when course changes (internship only)
  React.useEffect(() => {
    // Clear preview when filters change
    setStudents([]);
    setDocError("");

    if (!isInternship) return;

    if (!selectedCourse) {
      setInternshipSessionOptions([]);
      setSelectedInternshipSession("");
      return;
    }
    let abort = false;
    (async () => {
      setInternshipSessionLoading(true);
      setInternshipSessionError("");
      try {
        const url = new URL("http://localhost:5001/api/student-score/sessions/internship");
        url.searchParams.set("courseCode", selectedCourse);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Failed to load sessions: ${res.status}`);
        const json = await res.json();
        if (abort) return;
        const opts = asArray(json)
          .filter((s) => typeof s === "string" && s.trim())
          .map((s) => ({ value: s, text: s }))
          .sort(byText);
        setInternshipSessionOptions(opts);
        setSelectedInternshipSession(opts[0]?.value || "");
      } catch (e) {
        if (!abort) setInternshipSessionError(e.message || "Failed to load sessions");
      } finally {
        if (!abort) setInternshipSessionLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [isInternship, selectedCourse]);

  // Fetch mentorship sessions when listType changes to mentorship
  React.useEffect(() => {
    if (listType !== "mentorship") return;
    let abort = false;
    (async () => {
      setMentorshipSessionLoading(true);
      setMentorshipSessionError("");
      try {
        const res = await fetch("http://localhost:5001/api/student-score/sessions/mentorship");
        if (!res.ok) throw new Error(`Failed to load mentorship sessions: ${res.status}`);
        const json = await res.json();
        if (abort) return;
        const opts = asArray(json)
          .filter((s) => typeof s === "string" && s.trim())
          .map((s) => ({ value: s, text: s }))
          .sort(byText);
        setMentorshipSessionOptions(opts);
        setSelectedMentorshipSession(opts[0]?.value || "");
      } catch (e) {
        if (!abort) setMentorshipSessionError(e.message || "Failed to load sessions");
      } finally {
        if (!abort) setMentorshipSessionLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [listType]);

  // Change handler for list type: reset preview and filters appropriately
  function onChangeListType(next) {
    setListType(next);
    setStudents([]);
    setDocError("");
    if (next === "internship") {
      // internship: keep current filters or reset
      setSelectedMentorshipSession("");
    } else {
      // mentorship: hide course/session; clear them
      setSelectedCourse("");
      setSelectedInternshipSession("");
      setInternshipSessionOptions([]);
    }
  }

  async function onGenerate() {
    setDocError("");
    setDocLoading(true);
    try {
      if (isInternship) {
        const res = await fetch("http://localhost:5001/api/generate-list/internship", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseCode: selectedCourse,
            session: selectedInternshipSession,
          }),
        });
        if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
        const json = await res.json();
        setStudents(asArray(json.rows));
      } else {
        // mentorship
        const res = await fetch("http://localhost:5001/api/generate-list/mentorship", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: selectedMentorshipSession}), // pass selected session
        });
        if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
        const json = await res.json();
        setStudents(asArray(json.rows));
      }
    } catch (e) {
      setDocError(e.message || "Failed to generate list");
      setStudents([]);
    } finally {
      setDocLoading(false);
    }
  }

  async function downloadPdf() {
    try {
      if (isInternship) {
        const res = await fetch("http://localhost:5001/api/generate-list/internship/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseCode: selectedCourse, session: selectedInternshipSession }),
        });
        if (!res.ok) throw new Error(`Failed to generate PDF: ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `internship_list_${selectedCourse}_${selectedInternshipSession}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        // mentorship PDF
        const res = await fetch("http://localhost:5001/api/generate-list/mentorship/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: selectedMentorshipSession }), // pass selected session
        });
        if (!res.ok) throw new Error(`Failed to generate PDF: ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mentorship_list.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setDocError(e.message || "Failed to download PDF");
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>List Type</InputLabel>
                <Select value={listType} label="List Type" onChange={(e) => onChangeListType(e.target.value)}>
                  <MenuItem value="internship">Internship</MenuItem>
                  <MenuItem value="mentorship">Mentorship</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {isInternship ? (
              <>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel shrink>Course</InputLabel>
                    <Select
                      displayEmpty
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      disabled={courseLoading}
                      label="Course"
                    >
                      <MenuItem value="">
                        <em>{courseLoading ? "Loading..." : "Select a course"}</em>
                      </MenuItem>
                      {courseOptions.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.text}</MenuItem>
                      ))}
                    </Select>
                    {courseError && <Typography color="error">{courseError}</Typography>}
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel shrink>Session</InputLabel>
                    <Select
                      displayEmpty
                      value={selectedInternshipSession}
                      onChange={(e) => setSelectedInternshipSession(e.target.value)}
                      disabled={!selectedCourse || internshipSessionLoading}
                      label="Session"
                    >
                      <MenuItem value="">
                        <em>{internshipSessionLoading ? "Loading..." : "Select a session"}</em>
                      </MenuItem>
                      {internshipSessionOptions.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.text}</MenuItem>
                      ))}
                    </Select>
                    {internshipSessionError && <Typography color="error">{internshipSessionError}</Typography>}
                  </FormControl>
                </Grid>
              </>
            ) : (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel shrink>Session</InputLabel>
                  <Select
                    displayEmpty
                    value={selectedMentorshipSession}
                    onChange={(e) => setSelectedMentorshipSession(e.target.value)}
                    disabled={mentorshipSessionLoading}
                    label="Session"
                  >
                    <MenuItem value="">
                      <em>{mentorshipSessionLoading ? "Loading..." : "Select a session"}</em>
                    </MenuItem>
                    {mentorshipSessionOptions.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.text}</MenuItem>
                    ))}
                  </Select>
                  {mentorshipSessionError && <Typography color="error">{mentorshipSessionError}</Typography>}
                </FormControl>
              </Grid>
            )}
          </Grid>
          <Stack direction="row" spacing={2} style={{ marginTop: "16px" }}>
            <Button
              variant="contained"
              onClick={onGenerate}
              disabled={
                docLoading ||
                (isInternship && (!selectedCourse || !selectedInternshipSession)) ||
                (!isInternship && !selectedMentorshipSession)
              }
              startIcon={docLoading && <CircularProgress size={20} />}
            >
              {docLoading ? "Generating..." : "Generate"}
            </Button>
            {hasPreview && (
              <Button variant="outlined" onClick={downloadPdf}>
                Download PDF
              </Button>
            )}
            {docError && <Typography color="error">{docError}</Typography>}
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        {hasPreview ? (
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Typography variant="h6" gutterBottom>
                {isInternship
                  ? `Internship List — ${selectedCourse || "Course"} — ${selectedInternshipSession || "Session"}`
                  : "Mentorship List"}
              </Typography>
              <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Matric No</TableCell>
                      <TableCell>IC No</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Email</TableCell>
                      {!isInternship && <TableCell>Failed Courses</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {students.map((s, i) => (
                      <TableRow key={`${s.MATRIC_NO || "-"}-${i}`}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{s.STUDENT_NAME ?? "-"}</TableCell>
                        <TableCell>{s.MATRIC_NO ?? "-"}</TableCell>
                        <TableCell>{s.IC_NO ?? "-"}</TableCell>
                        <TableCell>{s.MOBILE_NO ?? s.PHONE_NO ?? "-"}</TableCell>
                        <TableCell>{s.EMAIL ?? "-"}</TableCell>
                        {!isInternship && <TableCell>{s.FAILED_COURSES ?? "-"}</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        ) : (
          <Card>
              <CardContent>
                  <Typography color="textSecondary">Choose options and click Generate to preview the list.</Typography>
              </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}