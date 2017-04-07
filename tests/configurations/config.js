module.exports = {
    default: {
        timeout: 15000,
        folder: "csp_test_files"
    },
    consistency: {
        docker: {
            folder: "csp_test_docker_files",
        },
        local: {
            folder: "csp_test_local_files",
        },
        remote: {
            folder: "csp_test_remote_files",
        }
    },
    compensation: {
        local: {
            folder: "csp_test_local_files",
        }
    }

};