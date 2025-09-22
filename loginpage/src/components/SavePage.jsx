// loginpage/src/components/SavePage.jsx
export default function Save({ user }) {
    const handleBack = () => {
        window.location.hash = '#/dashboard'
    }

    return (
        <div className="container my-5">
            <div className="row justify-content-center">
                <div className="col-12 col-lg-8">
                    <div className="card shadow-sm">
                        <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <h2 className="mb-2" style={{ fontFamily: '"Limelight", serif' }}>Save</h2>
                                    <p className="text-muted mb-0">
                                        {user?.email ? `Viewing saved items for ${user.email}` : 'Viewing your saved items'}
                                    </p>
                                </div>
                                <button className="btn btn-outline-secondary" onClick={handleBack}>
                                    Back to Dashboard
                                </button>
                            </div>

                            <hr className="my-4" />

                            <div className="text-start">
                                <h5 className="mb-3">Your saved items</h5>
                                <p className="text-muted">
                                    You haven’t saved anything yet. Explore content and click “Save” to see it appear here.
                                </p>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}


